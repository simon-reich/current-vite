<script setup lang="ts">
import { ref, computed, provide, watch, onMounted, onUnmounted, nextTick, useTemplateRef } from 'vue'
import { RouterView, useRouter, useRoute } from 'vue-router'
import { Sun, CalendarDays, Settings, ArrowUpDown, Tag, Flag, CircleArrowDown, LayoutList, LayoutGrid, X, ListChecks, Plus } from '@lucide/vue'
import PoolIcon from './components/icons/PoolIcon.vue'
import FocusDateWidget from './components/FocusDateWidget.vue'
import FocusDateNav from './components/FocusDateNav.vue'
import { useTodosStore, PRIORITY_TAG_ID, LOOP_TAG_ID, type LoopInterval, type Todo } from './stores/todos'
import { useThemeStore } from './stores/theme'
import { useChecksStore } from './stores/checks'
import { useScrollTracking } from './composables/useScrollTracking'
import { onQuickExpandEnter, onQuickExpandLeave } from './composables/useQuickExpand'
import { activeModal } from './composables/useModalGuard'
import { runLoopSchedule, scheduleLoopMidnightCheck, isLoopDueToday } from './composables/useLoopSchedule'
import { toasts, spawnToast, spawnSentToCurrentToast } from './composables/useToast'
import { todayStr, tomorrowStr } from './composables/useToday'
import { useFocusDateNav } from './composables/useFocusDateNav'
import ScrollDivider from './components/ScrollDivider.vue'
import LoopPicker from './components/LoopPicker.vue'
import { openTagMenuId, openCheckMenuId, cycleOpenCard, closeActiveCard } from './components/TodoCard.vue'
// Frame-celebration pre-completion teaser — commented out together with
// the watch(openCheckMenuId, ...) block below and celebrateBackground's
// own swap in TodoCard.vue while the old particle celebrations are back
// in use (see that file's own comment for why). The teaser is meaningless
// for the particle effects, which have no single frozen "first frame" to
// preview.
// import { showCelebrationTeaser, hideCelebrationTeaser } from './components/TodoCard.vue'
// import { drawCelebrationKey } from './composables/useCelebrations'

const router = useRouter()
const route = useRoute()

// Tab/Shift+Tab always toggle between Overview and Current, whether or not
// a card is open — opening a card no longer takes over Tab (see ↑↓ below
// for card-cycling), and a Tab-driven view switch just closes whatever was
// open the same way any other navigation does (see the route watch below).
// Only exception: focus in a text field, where Tab should behave normally.
// This is the single place Tab is handled at all. Calendar isn't part of
// this cycle — it's reached via C instead (see toggleCalendar), same
// "toggle back to whichever main view you came from" pattern as Settings/X.
const viewOrder = ['/all', '/current']

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  const tag = el?.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || !!el?.isContentEditable
}

// router.push() resolves asynchronously, and route.path briefly reflects an
// in-between state while it does (verified: reading it right after a push
// can momentarily show "/", the redirect route, before it settles on the
// actual target). Reading route.path fresh on every keypress means a Tab
// press landing in that window finds it isn't one of the three views and
// silently gives up. Tracking our own optimistic index instead — updated
// the instant we decide to navigate, corrected from route.path only when it
// actually lands on one of the three views — means consecutive presses never
// depend on that async settling.
let currentViewIdx = viewOrder.indexOf(route.path)

// Last of the three main views actually visited — Settings isn't one of
// them, so toggling it (via the button or the X shortcut) can always return
// to wherever you really came from instead of hardcoding Overview.
let lastMainViewPath = viewOrder.includes(route.path) ? route.path : '/all'

// Whatever view we're leaving, a card left open (or mid-edit) there should
// never survive the switch — coming back later should never show something
// still open or half-typed. Covers every way of navigating, not just Tab
// (a plain nav-link click bypasses onGlobalKeydown entirely).
watch(() => route.path, (path, oldPath) => {
  closeActiveCard()
  const idx = viewOrder.indexOf(path)
  if (idx !== -1) currentViewIdx = idx
  if (viewOrder.includes(path)) lastMainViewPath = path
  // Arriving at Overview resets its own filters (tags/prio/date) — unless
  // it's a Settings round-trip, which reads as a quick detour rather than
  // actually leaving Overview (same exemption as the add-todo draft below).
  // Coming back from Current or Calendar, though, should always land on a
  // clean, unfiltered Overview rather than whatever was left dialed in
  // from before.
  if (path === '/all' && oldPath !== '/settings') clearAllFilters()
  // Same "never survive leaving" rule now applies to an in-progress
  // add-todo draft — except a Settings round-trip, which reads as a quick
  // detour (tweak a color, come right back) rather than actually being
  // done with adding the todo. That means both legs of the trip are
  // exempt: going *to* Settings (obviously) but also coming *back* — the
  // draft was already spared once on the way in, wiping it the instant
  // you return would undo that for no reason. See resetTodoDraft/
  // onTodoBlur for the other cases that clear it (X button, deleting the
  // title down to nothing, blurring an already-empty input).
  if (path !== '/settings' && oldPath !== '/settings') {
    if (todoBlurCloseTimer) { clearTimeout(todoBlurCloseTimer); todoBlurCloseTimer = null }
    showTagModal.value = false
    resetTodoDraft()
  }
})

const DESKTOP_BREAKPOINT = 1024

// Y held down — see onGlobalKeydown/onGlobalKeyup below.
const shortcutHintsVisible = ref(false)

// Single-letter shortcuts (S/G/T/A/X below) never fire while a card is open
// (its own ↑↓-cycling already takes priority, same idea as above) or while
// typing anywhere else — plain letters have to stay safe to type normally —
// nor with a modifier held, so they don't hijack e.g. Cmd+A/Ctrl+A.
function shortcutsBlocked(e: KeyboardEvent): boolean {
  return !!(openTagMenuId.value || openCheckMenuId.value) || isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey
}

function onGlobalKeydown(e: KeyboardEvent) {
  // All keyboard shortcuts (view/card-cycling included) are desktop-only —
  // below this breakpoint there's essentially never a physical keyboard
  // around, and leaving them active here was exactly the kind of surface
  // that kept producing odd side effects.
  if (window.innerWidth <= DESKTOP_BREAKPOINT) return

  // A confirmation modal being open overrides everything else here —
  // Escape cancels it, Enter confirms it, and nothing else (view/card
  // cycling, single-letter shortcuts, a card's own Escape/Enter handling further
  // down its own separate listener) should fire underneath while it's
  // up. stopImmediatePropagation matters: TodoCard's own onCardKeydown
  // listens on this same document too, registered later (only once a
  // card opens), so without it Escape would also reach that handler and
  // close the card behind the modal.
  if (activeModal.value) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopImmediatePropagation()
      activeModal.value.onCancel()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopImmediatePropagation()
      activeModal.value.onConfirm?.()
    } else {
      e.stopImmediatePropagation()
    }
    return
  }

  if (e.key === 'Tab') {
    if (isTypingTarget(e.target)) return
    if (currentViewIdx === -1) return
    e.preventDefault()
    currentViewIdx = (currentViewIdx + (e.shiftKey ? -1 : 1) + viewOrder.length) % viewOrder.length
    router.push(viewOrder[currentViewIdx])
    return
  }

  // ↑↓ cycle between open cards — checked before isTypingTarget's typing
  // guard normally would (see shortcutsBlocked below), but only fires while
  // a card's tag-/check-menu is open AND focus isn't in a text field: the
  // title textarea needs ↑↓ free to move the cursor between lines, so
  // cycling can't carry an in-progress edit to the next card the way Tab
  // used to (see cycleOpenCard's own comment) — it saves the edit instead.
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    if (!(openTagMenuId.value || openCheckMenuId.value)) return
    if (isTypingTarget(e.target)) return
    e.preventDefault()
    cycleOpenCard(e.key === 'ArrowUp' ? -1 : 1)
    return
  }

  if (shortcutsBlocked(e)) return
  const key = e.key.toLowerCase()

  // S — toggle sort (date / A–Z) on Overview, matching where the sort
  // button itself is shown. Reused on Current for its own "expand subs"
  // switch (only when Subs are actually enabled) — same letter, since the
  // two views never show both controls at once. No-op everywhere else.
  if (key === 's') {
    if (route.path === '/all') {
      e.preventDefault()
      toggleSort()
    } else if (route.path === '/current' && themeStore.subsEnabled) {
      e.preventDefault()
      themeStore.toggleExpandCurrentSubs()
    }
    return
  }

  // G — toggle grid/list layout. Same Overview-only restriction as S.
  if (key === 'g') {
    if (route.path !== '/all') return
    e.preventDefault()
    listView.value = !listView.value
    return
  }

  // N — jump into the add-todo input ("new"). Valid on Overview and Current,
  // the only views where that input is actually enabled (dimmed/inert on
  // Settings and Calendar).
  if (key === 'n') {
    if (route.path !== '/all' && route.path !== '/current') return
    e.preventDefault()
    todoInputRef.value?.focus()
    return
  }

  // A — the All filter (clears every active tag/prio/loop filter at
  // once). Overview-only, like every other filter shortcut — Current can't
  // be filtered at all.
  if (key === 'a') {
    if (route.path !== '/all') return
    e.preventDefault()
    clearAllFilters()
    return
  }

  // D — cycle the date filter (default → hide → only → default, starts
  // on "hide"), same three states as clicking the Date button itself.
  // Reuses the letter an open card's own D (delete/remove, see
  // TodoCard.vue's onCardKeydown) already uses — no conflict, since
  // shortcutsBlocked() above already returns whenever a card is open,
  // same mutual-exclusion pattern as ↑↓ (card-cycling) vs. this whole
  // single-letter block.
  if (key === 'd') {
    if (route.path !== '/all') return
    e.preventDefault()
    cycleLoopFilter()
    return
  }

  // T — jump into the tag input. Desktop only: below the tablet breakpoint
  // the sidebar (and its tag input) isn't even rendered — reaching it means
  // first opening the mobile tag panel, a touch-driven flow a keyboard
  // shortcut doesn't fit anyway. Overview-only, unlike A — Current is
  // deliberately unfilterable, so its whole tag/filter UI is grayed out
  // and inert (see #app.is-current), this shortcut included.
  if (key === 't') {
    if (window.innerWidth <= DESKTOP_BREAKPOINT) return
    if (route.path !== '/all') return
    e.preventDefault()
    openTagInput()
    return
  }

  // P — toggle the priority filter (All ↔ Prio). Overview-only — see T
  // above, Current can't be filtered at all anymore.
  if (key === 'p') {
    if (route.path !== '/all') return
    e.preventDefault()
    toggleTag(PRIORITY_TAG_ID)
    return
  }

  // Enter — open the first todo card in the current list, same as clicking
  // it. A real click (not reimplementing toggleTagMenu/toggleCheckMenu
  // here) so Overview vs Current's different open behavior stays exactly
  // whatever TodoCard.vue itself already does for a click, nothing
  // duplicated. shortcutsBlocked() above already guarantees no card is
  // open yet, so there's always at most a "first" card to jump into, never
  // an already-open one to fight with its own Enter handling (accepting an
  // edit).
  if (key === 'enter') {
    if (route.path !== '/all' && route.path !== '/current') return
    e.preventDefault()
    document.querySelector<HTMLElement>('.content-inner .todo-card-main')?.click()
    return
  }

  // X — toggle Settings, returning to whichever main view you came from.
  if (key === 'x') {
    e.preventDefault()
    toggleSettings()
    return
  }

  // C — toggle Calendar, returning to whichever main view you came from.
  // Same pattern as X/Settings — Calendar isn't part of the Tab cycle.
  if (key === 'c') {
    e.preventDefault()
    toggleCalendar()
    return
  }

  // Y — hold to reveal which key does what, as a label floating above each
  // shortcut's own control, all on one shared line (see computeShortcutHints
  // below). No preventDefault: this isn't an action, just a transient
  // display state, and swallowing the keystroke isn't needed
  // (shortcutsBlocked() above already guarantees we're not in a text field
  // by this point, so there's nothing to accidentally interfere with).
  if (key === 'y') {
    computeShortcutHints()
    shortcutHintsVisible.value = true
  }
}

// Released (or the window lost focus entirely while held, which never
// fires its own keyup) — either way the hints shouldn't stay stuck on.
function onGlobalKeyup(e: KeyboardEvent) {
  if (e.key.toLowerCase() === 'y') shortcutHintsVisible.value = false
}

function onWindowBlur() {
  shortcutHintsVisible.value = false
}

// ── Shortcut hints (Y held) ──
// Measured live off the real DOM rather than positioned via CSS: the
// targets are scattered across three separate grid columns (sidebar-head,
// main-head, settings-head) with different internal padding/centering, so
// there's no shared CSS containing block that would let them land on one
// horizontal line "for free" — and it needs to keep working unchanged
// whenever the window is resized (main-head-inner's own max-width
// re-centers its contents, etc.).
// RouterLink instances, not plain elements — component template refs give
// the component instance, so every read below goes through .$el for the
// actual anchor tag.
const allNavRef = ref<{ $el: HTMLElement } | null>(null)
const focusNavRef = ref<{ $el: HTMLElement } | null>(null)
const calendarNavRef = ref<{ $el: HTMLElement } | null>(null)
const sortListBtnRef = ref<HTMLElement | null>(null)
const sortOrderBtnRef = ref<HTMLElement | null>(null)
const settingsBtnRef = ref<HTMLElement | null>(null)
// A/P/D's targets — Overview's All/Prio/Date trio, always in the right
// sidebar now (see .sidebar-right).
const allBtnSidebarRef = ref<HTMLElement | null>(null)
const prioBtnSidebarRef = ref<HTMLElement | null>(null)
const loopBtnSidebarRef = ref<HTMLElement | null>(null)

interface ShortcutHint { key: string; x: number; y: number; anchor?: 'above' | 'right' }
const shortcutHints = ref<ShortcutHint[]>([])

// Enter gets its own row instead of the generic single-key pill every
// other hint uses — it needs to show the follow-up keys that apply once
// the card it opens is actually open (↑↓/Enter/Space in Overview,
// ↑↓/←→/Enter in Current), as a plain arrow + more boxed keys alongside
// it rather than crammed into one pill. Positioned the same way Enter's
// pill used to be (bottom-center anchored above the first card).
interface HintPart { text: string; kind: 'key' | 'arrow' | 'label' }
const enterHintPos = ref<{ x: number; y: number } | null>(null)
const enterFollowupParts = computed<HintPart[]>(() => {
  const box = (text: string): HintPart => ({ text, kind: 'key' })
  const arrow = (text: string): HintPart => ({ text, kind: 'arrow' })
  const label = (text: string): HintPart => ({ text, kind: 'label' })
  if (route.path === '/all') {
    return [box('Enter'), arrow('→'), box('↑↓'), label('(cards)'), box('Space'), label('(edit)'), box('F'), label('(current)'), box('D'), label('(delete)')]
  }
  return [box('Enter'), arrow('→'), box('↑↓'), label('(cards)'), box('←→'), label('(select)'), box('Enter'), label('(confirm)'), box('Space'), label('(edit)'), box('D'), label('(remove)')]
})

// Calendar's own arrow-key navigation (see Calendar.vue's onKeydown) isn't
// a single letter like the rest of these, so it gets the same boxed-row
// treatment as Enter's follow-ups instead of a plain .shortcut-hint pill.
const calendarHintPos = ref<{ x: number; y: number } | null>(null)
const calendarHintParts: HintPart[] = [
  { text: '←→', kind: 'key' }, { text: '(day)', kind: 'label' },
  { text: '↑↓', kind: 'key' }, { text: '(week)', kind: 'label' },
]

// Current's S (expand-subs switch, pinned under Settings on desktop — see
// Current.vue's .expand-subs-row) — same "measure the real target" approach
// as calendarHintPos above, since it doesn't live in the shared header
// line the rest of the plain-pill hints share (see the 'S' targets entry).
const expandSubsHintPos = ref<{ x: number; y: number } | null>(null)

// Overview's All/Prio/Date trio now always lives in the right-column tag
// filters (allBtnSidebarRef etc.), regardless of themeStore.tagsEnabled —
// the row/tagsEnabled fallback (allBtnRowRef etc.) only still exists for
// other routes' sidebar-head (Current/Settings/Calendar), which A/P/D's
// hints never target (see the `route.path === '/all'` guard below).
function getAllBtnRect(): DOMRect | null {
  return allBtnSidebarRef.value?.getBoundingClientRect() ?? null
}

function getPrioBtnRect(): DOMRect | null {
  return prioBtnSidebarRef.value?.getBoundingClientRect() ?? null
}

function getLoopBtnRect(): DOMRect | null {
  return loopBtnSidebarRef.value?.getBoundingClientRect() ?? null
}

function computeShortcutHints() {
  const targets: { key: string; el: HTMLElement | null }[] = [
    { key: 'C', el: calendarNavRef.value?.$el ?? null },
    { key: 'G', el: route.path === '/all' ? sortListBtnRef.value : null },
    // Current's own S target (the expand-subs switch) is measured separately
    // below (expandSubsHintPos) rather than folded in here — it doesn't
    // sit in the header row like every other target in this list, so
    // sharing their one computed line (see below) would float its hint at
    // the header's height with the switch's x, nowhere near the switch
    // itself.
    { key: 'S', el: route.path === '/all' ? sortOrderBtnRef.value : null },
    { key: 'N', el: (route.path === '/all' || route.path === '/current') ? todoInputRef.value : null },
    { key: 'T', el: route.path === '/all' && themeStore.tagsEnabled ? (tagInputOpen.value ? tagInputRef.value : tagAddBtnRef.value) : null },
    { key: 'X', el: settingsBtnRef.value },
  ]
  const measured = targets
    .filter((t): t is { key: string; el: HTMLElement } => !!t.el)
    .map(t => ({ key: t.key, rect: t.el.getBoundingClientRect() }))

  // Tab spans both All and Current icons now (it only toggles between the
  // two) rather than pointing at a single button like the rest — a
  // synthetic rect covering just those two instead of the old topNavRef
  // that used to span all three (back when Tab cycled through Calendar
  // too). Only `.top`/`.left`/`.width` are read below, so a plain object
  // stands in fine for the real DOMRect the others use.
  if (allNavRef.value && focusNavRef.value) {
    const a = allNavRef.value.$el.getBoundingClientRect()
    const f = focusNavRef.value.$el.getBoundingClientRect()
    measured.push({
      key: 'Tab',
      rect: { top: Math.min(a.top, f.top), left: a.left, width: (f.right - a.left) } as DOMRect,
    })
  }

  const hints: ShortcutHint[] = []
  if (measured.length) {
    // One shared line, 8px above whichever target sits highest — every
    // other hint ends up with a slightly bigger gap above its own control,
    // but all of them still bottom-align on the exact same y.
    const lineY = Math.min(...measured.map(m => m.rect.top)) - 8
    hints.push(...measured.map(m => ({ key: m.key, x: m.rect.left + m.rect.width / 2, y: lineY })))
  }

  // Enter only applies on Overview/Current (same restriction as the
  // shortcut itself), floated above the first card — see enterHintPos/
  // enterFollowupParts above for its own row instead of a plain pill.
  enterHintPos.value = null
  if (route.path === '/all' || route.path === '/current') {
    const listRect = contentInnerRef.value?.getBoundingClientRect()
    if (listRect) {
      // content-inner's own top edge sits right below the header (before
      // its 36px padding-top), well above where any card actually starts —
      // using it directly floated "Enter" up onto the add-todo input. The
      // first rendered card's own top (still centered on content-inner's
      // full width, just not its own x) is where the list visually begins.
      // With no cards at all, fall back to the "No todos"/"Nothing in
      // focus" placeholder's own top instead of content-inner's — same
      // reasoning, just no card to measure.
      const firstCardTop = document.querySelector('.content-inner .todo-card-main')?.getBoundingClientRect().top
      const emptyTop = document.querySelector('.content-inner .empty')?.getBoundingClientRect().top
      const enterY = (firstCardTop ?? emptyTop ?? listRect.top) - 13
      enterHintPos.value = { x: listRect.left + listRect.width / 2, y: enterY }
    }
  }

  // Calendar's arrow-key navigation — see calendarHintPos/calendarHintParts
  // above — floated above the calendar grid itself.
  calendarHintPos.value = null
  if (route.path === '/calendar') {
    const calRect = document.querySelector('.calendar-view .cal')?.getBoundingClientRect()
    if (calRect) calendarHintPos.value = { x: calRect.left + calRect.width / 2, y: calRect.top - 13 }
  }

  expandSubsHintPos.value = null
  if (route.path === '/current' && themeStore.subsEnabled) {
    const switchRect = document.querySelector('.expand-subs-row .switch')?.getBoundingClientRect()
    if (switchRect) expandSubsHintPos.value = { x: switchRect.left + switchRect.width / 2, y: switchRect.top - 13 }
  }

  // A/P/D are Overview-only (Current can't be filtered at all) and each
  // float to the right of their own button, vertically centered —
  // they used to share one line above the whole All/Prio pair, but with
  // three of them now individually labeling separate buttons reads
  // clearer right next to each one than stacked above the group.
  if (route.path === '/all') {
    const rightOf = (key: string, rect: DOMRect | null) =>
      rect ? { key, x: rect.right + 16, y: rect.top + rect.height / 2, anchor: 'right' as const } : null

    hints.push(
      ...[
        rightOf('A', getAllBtnRect()),
        rightOf('P', getPrioBtnRect()),
        rightOf('D', getLoopBtnRect()),
      ].filter((h): h is NonNullable<typeof h> => !!h)
    )
  }

  shortcutHints.value = hints
}

// Keeps the hints correctly placed if the window is resized while Y is
// still held down, rather than only computing them once on keydown.
function onWindowResizeForHints() {
  if (shortcutHintsVisible.value) computeShortcutHints()
}

const themeStore = useThemeStore()

let lastViewportHeight = 0
function onViewportResize() {
  const vv = window.visualViewport
  if (!vv) return
  const shrunk = lastViewportHeight > 0 && vv.height > lastViewportHeight + 100
  lastViewportHeight = vv.height
  if (shrunk && document.activeElement === todoInputRef.value) {
    todoInputRef.value?.blur()
  }
}

let stopLoopMidnightCheck: (() => void) | null = null

// Backstop for scheduleLoopMidnightCheck's own long-lived setTimeout: that
// timer doesn't survive the machine actually sleeping overnight (a closed
// laptop lid, standby) — no JS runs at all while suspended, and depending
// on the browser/OS the timer can come back late or not at all instead of
// firing the moment the deadline's passed. Re-running both daily checks
// whenever the tab becomes visible again catches exactly that case, right
// when a human is actually looking at it again — no reload needed. Both
// checks are cheap no-ops if nothing's actually due (processedToday /
// lastThemeRotationDate), so re-running them on every tab-refocus, not
// just after an overnight gap, is harmless.
function onVisibilityChange() {
  if (document.visibilityState !== 'visible') return
  store.rolloverExpiredFocusDates()
  runLoopSchedule(store)
  themeStore.runDailyThemeRotation()
  checksStore.refreshToday()
}

onMounted(() => {
  store.ensureSystemTags()
  store.ensureSubsField()
  store.ensureInCurrentField()
  themeStore.apply(themeStore.activeBg, themeStore.activeGray)
  lastViewportHeight = window.visualViewport?.height ?? 0
  window.visualViewport?.addEventListener('resize', onViewportResize)
  document.addEventListener('keydown', onGlobalKeydown)
  document.addEventListener('keyup', onGlobalKeyup)
  window.addEventListener('blur', onWindowBlur)
  window.addEventListener('resize', onWindowResizeForHints)
  document.addEventListener('visibilitychange', onVisibilityChange)
  // Sends due loop todos to Current now, then again every midnight while
  // this tab stays open (no reload) — see useLoopSchedule.ts. The daily
  // theme rotation (see stores/theme.ts) and Checks' own due-today
  // recompute (see stores/checks.ts's refreshToday) piggyback on the same
  // "once now, once every midnight after" timing, just via the second
  // scheduleLoopMidnightCheck argument instead of their own timers.
  store.rolloverExpiredFocusDates()
  runLoopSchedule(store)
  themeStore.runDailyThemeRotation()
  checksStore.refreshToday()
  stopLoopMidnightCheck = scheduleLoopMidnightCheck(store, () => {
    store.rolloverExpiredFocusDates()
    themeStore.runDailyThemeRotation()
    checksStore.refreshToday()
  })
})

onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', onViewportResize)
  document.removeEventListener('keydown', onGlobalKeydown)
  document.removeEventListener('keyup', onGlobalKeyup)
  window.removeEventListener('blur', onWindowBlur)
  window.removeEventListener('resize', onWindowResizeForHints)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  stopLoopMidnightCheck?.()
})

const store = useTodosStore()
const checksStore = useChecksStore()

// Pre-completion celebration teaser (see TodoCard.vue's
// showCelebrationTeaser for the why-here) — a single watcher on
// openCheckMenuId itself, not one per TodoCard instance watching its own
// showMenu: cycleOpenCard (↑↓-cycling between open Current cards) sets
// openCheckMenuId straight to the next card in one ref assignment, and
// two *different* components' own watchers reacting to that raced each
// other over the shared teaser state in whatever order Vue happened to
// flush them — cycling backward reliably lost that race. One watcher
// owned by one place, driven by the one ref every transition shares, has
// nothing left to race.
//
// Commented out (not deleted) together with the frame-celebration imports
// above and celebrateBackground's swap in TodoCard.vue — see that file's
// comment. Re-enable both together if the frame animations come back.
// watch(openCheckMenuId, (id) => {
//   // Always clear the previous teaser first — cycleOpenCard jumps
//   // openCheckMenuId straight from one card's id to the next in one ref
//   // assignment (never passing through null in between), so without this
//   // every direct card-to-card cycle just piled another teaser overlay on
//   // top of the last instead of replacing it.
//   hideCelebrationTeaser()
//   const todo = id ? store.todos.find(t => t.id === id) : undefined
//   if (!todo || !themeStore.celebrationsEnabled) return
//   // Falls back to drawing (and persisting) a fresh key here for a todo
//   // that was already inCurrent before Todo.celebration existed —
//   // sendToCurrent normally assigns it.
//   const key = todo.celebration ?? drawCelebrationKey()
//   if (!todo.celebration) store.updateTodo(todo.id, { celebration: key })
//   showCelebrationTeaser(key)
// })

// ── Tag sidebar ──
const tagInput = ref('')
const tagInputRef = ref<HTMLInputElement | null>(null)

// ── Delete tag confirmation ──
const deleteConfirm = ref<{ id: string; label: string } | null>(null)

function handleDeleteTag(id: string, label: string) {
  const inUse = store.todos.some(t => !t.deletedAt && t.tags.includes(id))
  if (inUse) { deleteConfirm.value = { id, label }; return }
  store.deleteTag(id)
  deactivateTag(id)
}

function confirmDeleteTag() {
  if (deleteConfirm.value) {
    store.deleteTag(deleteConfirm.value.id)
    deactivateTag(deleteConfirm.value.id)
  }
  deleteConfirm.value = null
}

watch(deleteConfirm, (open) => {
  activeModal.value = open ? { onCancel: () => { deleteConfirm.value = null }, onConfirm: confirmDeleteTag } : null
})

function handleTagKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { (e.target as HTMLElement)?.blur(); return }
  if (e.key !== 'Enter') return
  const labels = tagInput.value.split(',').map(s => s.trim()).filter(Boolean)
  let dupIndex = 0
  labels.forEach(label => {
    if (!store.tags.find(t => t.label.toLowerCase() === label.toLowerCase())) {
      store.addTag(label)
    } else {
      const i = dupIndex++
      setTimeout(() => spawnToast(`already exists: ${label}`, '151px', `${168 + i * 22}px`, true), i * 300)
    }
  })
  tagInput.value = ''
}

// Overview's right-column tag filters: the tag input is collapsed behind a
// plus icon by default (see App.vue's `.tag-add-row`) — it's needed rarely
// enough that it doesn't deserve permanent space next to the filter chips.
// Reuses tagInputRef/tagInput/handleTagKey above, which sidebar-head's own
// (route !== '/all') tag input no longer overlaps with once expanded.
const tagInputOpen = ref(false)
const tagAddBtnRef = ref<HTMLElement | null>(null)

async function openTagInput() {
  tagInputOpen.value = true
  await nextTick()
  tagInputRef.value?.focus()
}

function onTagInputBlur() {
  if (!tagInput.value) tagInputOpen.value = false
}

const activeTagIds = ref<string[]>([])

// Deleting a tag that's currently used as a filter should drop it from the
// filter too — otherwise the list stays filtered by a tag that no longer
// exists. An empty array already means "all", so no extra fallback needed.
function deactivateTag(id: string) {
  const idx = activeTagIds.value.indexOf(id)
  if (idx !== -1) activeTagIds.value.splice(idx, 1)
}

function toggleTag(id: string) {
  const idx = activeTagIds.value.indexOf(id)
  if (idx === -1) activeTagIds.value.push(id)
  else activeTagIds.value.splice(idx, 1)
}

// Date gets its own three-state cycle instead of the plain multi-select
// toggle every other filter uses: default (date-tagged todos shown like
// everything else) → hide (filter them out entirely) → only (show just
// date-tagged todos) → back to default — see AllTodos.vue for where this
// actually filters the list. Starts on "hide": a date/loop todo not due
// yet is mostly just clutter in Overview, so it's out of the way until
// you deliberately go looking for it (via "only") or turn filtering off
// entirely (cycling to "default").
const loopFilterMode = ref<'default' | 'only' | 'hide'>('hide')

function cycleLoopFilter() {
  loopFilterMode.value =
    loopFilterMode.value === 'default' ? 'hide' :
    loopFilterMode.value === 'hide' ? 'only' : 'default'
}

// "All" resets loop filtering back to its own starting point, "hide" —
// not "default" (unfiltered) — for the same reason "hide" is the initial
// state to begin with: a not-yet-due date todo sends itself to Current once
// it's actually due, so seeing it in Overview beforehand is just clutter,
// even after an explicit "clear everything" reset. Still reachable via D
// if you want it. Loop's own state only resets here, on this explicit
// clear-everything action — never as a side effect of toggling some other
// tag.
function clearAllFilters() {
  activeTagIds.value = []
  loopFilterMode.value = 'hide'
}

// The filtering is additive/OR (activeTagIds already works that way: any
// todo matching *any* selected tag shows) — loop's "only" state should
// join that same union instead of being ANDed on top separately, which
// used to mean picking e.g. Prio while loop was "only" left just the
// prio+loop intersection instead of adding prio-tagged todos in too.
// This single computed drives both the actual filtering (AllTodos.vue)
// and every All/Prio/tag-chip's active/dimmed state below, so both stay
// in sync with what's really being matched.
const effectiveFilterTagIds = computed(() =>
  loopFilterMode.value === 'only' ? [...activeTagIds.value, LOOP_TAG_ID] : activeTagIds.value
)

// ── Add todo ──
const todoInput = ref('')
const todoInputRef = ref<HTMLInputElement | null>(null)
const showTagModal = ref(false)
const newTodoTagIds = ref<string[]>([])
const newTodoLoopInterval = ref<LoopInterval | undefined>(undefined)
const newTodoSubs = ref<string[]>([])
const newSubDraft = ref('')
const newSubInputRef = ref<HTMLInputElement | null>(null)

// Tags off: the add-todo checkbox row still offers the priority tag (it's
// not a real tag from the user's point of view, just the marker the
// All/Priority filter reads), but user-created tags stay hidden here too —
// otherwise disabling tags in Settings wouldn't actually hide them from
// this row.
const addTagModalTags = computed(() => themeStore.tagsEnabled ? store.tags : store.tags.filter(t => t.id === PRIORITY_TAG_ID || t.id === LOOP_TAG_ID))

// Date checked for the first time in this add-session: default to a
// one-time due date today (Once mode) instead of leaving the picker in
// its ambiguous "nothing selected" state.
watch(newTodoTagIds, (ids) => {
  if (ids.includes(LOOP_TAG_ID) && !newTodoLoopInterval.value) {
    newTodoLoopInterval.value = { mode: 'once', startDate: todayStr() }
  }
})

// Deleting the title back down to nothing discards the rest of the draft
// (tags, loop interval) immediately, same as the X button — typing it
// back doesn't un-delete a todo, so there's nothing to preserve once the
// title itself is gone.
watch(todoInput, (val) => {
  if (!val) {
    newTodoTagIds.value = []
    newTodoLoopInterval.value = undefined
    newTodoSubs.value = []
    newSubDraft.value = ''
  }
})

// Enter commits the draft into newTodoSubs and clears+refocuses the same
// input, same "next line opens" illusion as TodoCard.vue's own sub input.
function commitNewSub() {
  const trimmed = newSubDraft.value.trim()
  if (!trimmed) return
  newTodoSubs.value.push(trimmed)
  newSubDraft.value = ''
}

// Tab out of the title input jumps straight into the sub draft input
// instead of doing whatever Tab would otherwise do (nothing here, since
// the top-level add-todo input isn't part of any Tab-cycling) — only
// while the tag/sub panel is actually open and subs are enabled.
function onTodoTitleTabKeydown(e: KeyboardEvent) {
  if (e.key !== 'Tab' || e.shiftKey) return
  if (!showTagModal.value || !themeStore.subsEnabled) return
  e.preventDefault()
  nextTick(() => newSubInputRef.value?.focus())
}

// Mirrors onTodoTitleTabKeydown the other way — only one sub field exists
// here (already-added subs are plain chips, not fields), so both
// directions of the cycle collapse to the same single hop back to the
// title. Escape fully replicates the title input's own Escape (close the
// whole panel), not just blurring this one field, so Escape keeps working
// the same everywhere in this flow.
function onSubDraftKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commitNewSub()
    return
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    todoInputRef.value?.focus()
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    showTagModal.value = false
    newSubInputRef.value?.blur()
  }
}

function onTodoFocus() {
  if (addTagModalTags.value.length > 0) showTagModal.value = true
}

function onTodoInput() {
  if (addTagModalTags.value.length > 0) showTagModal.value = true
}

// Tracked so a genuinely-focusable control inside the panel itself (the
// loop picker's custom day count / date fields) can cancel this — those
// need real focus to work, which blurs the main input same as clicking
// fully away does, but shouldn't be treated as abandoning the draft.
let todoBlurCloseTimer: ReturnType<typeof setTimeout> | null = null

function onTodoBlur() {
  todoBlurCloseTimer = setTimeout(() => {
    showTagModal.value = false
    // A title's actually been typed — clicking away almost certainly means
    // glancing at something else, not abandoning the todo, so the draft
    // (title, tags, loop interval) stays staged for whenever the input is
    // focused again. Still fully discarded by the X button, deleting the
    // title back down to nothing (see the todoInput watch below), or
    // switching views (see the route watch above) — Escape included, since
    // that also just blurs the input and lands here.
    if (!todoInput.value.trim()) resetTodoDraft()
  }, 200)
}

// Escape on the add-todo input itself has to defer to a modal opened from
// inside it (LoopPicker's "from"/"starts" date picker) — that modal is a
// Teleport, so it never actually moves focus off this input (see
// LoopPicker's mousedown.prevent), meaning this handler is still the one
// that receives the keydown. Without this guard, Escaping the date modal
// closed the whole tag/loop panel and blurred the input in the same
// keystroke — this handler runs at the input itself, before the event
// even reaches onGlobalKeydown's activeModal handling further up the
// document, so stopImmediatePropagation there comes too late to stop it.
function onTodoInputEscape() {
  if (activeModal.value) return
  showTagModal.value = false
  todoInputRef.value?.blur()
}

function keepTodoModalOpen() {
  if (todoBlurCloseTimer) {
    clearTimeout(todoBlurCloseTimer)
    todoBlurCloseTimer = null
  }
  showTagModal.value = true
}

// Fully discards whatever's staged (title, tags, loop interval) — called
// from the cases that actually mean "start over": blurring an empty
// input, deleting the title back to nothing, the X button, and switching
// views. A blur with a title still typed does *not* call this — see
// onTodoBlur.
function resetTodoDraft() {
  todoInput.value = ''
  newTodoTagIds.value = []
  newTodoLoopInterval.value = undefined
  newTodoSubs.value = []
  newSubDraft.value = ''
}

function clearTodoInput() {
  todoInput.value = ''
  todoInputRef.value?.focus()
}

function addTodo() {
  if (!todoInput.value.trim()) return
  const todo = store.addTodo(todoInput.value, {
    tags: [...newTodoTagIds.value],
    loopInterval: newTodoTagIds.value.includes(LOOP_TAG_ID) ? newTodoLoopInterval.value : undefined,
    subs: [...newTodoSubs.value],
  })
  // A Date todo (once or loop) not actually due yet shouldn't land on
  // Current just because it was typed there — same rule as any other Date
  // todo, which only ever auto-joins Current once it's due (see
  // runLoopSchedule). It's created and stays in the pool instead.
  const dateTodoNotYetDue = !!todo.loopInterval && !isLoopDueToday(todo.loopInterval, new Date(), todo.createdAt.slice(0, 10))
  if (route.path === '/current' && viewingDate.value) {
    // Viewing a Date List instead of the actual Current pool — typing a
    // todo here means "put it on that list", not "send it to Current"
    // (inCurrent and focusDates are independent memberships, see
    // CLAUDE.md's Date-Feature section). Bypasses the due-date gate below
    // entirely: picking a specific list to view is an explicit placement,
    // not the automatic "is this due yet" join Current itself gets.
    store.assignFocusDate(todo.id, viewingDate.value)
  } else if (route.path === '/current') {
    if (!dateTodoNotYetDue) sendNewTodoToCurrent(todo)
  }
  // A brand-new loop todo due today (e.g. start date = today, daily)
  // shouldn't have to wait for the next reload/midnight check — but
  // sending it instantly made it look like the add itself had failed
  // (the todo never showed up in All, since All filters out inCurrent).
  // Let it appear in the list first, then move it the same way clicking
  // its own "+" button would, with a toast explaining where it went.
  else if (todo.loopInterval && !dateTodoNotYetDue) {
    setTimeout(() => {
      spawnSentToCurrentToast(todo.id)
      sendNewTodoToCurrent(todo)
    }, 600)
  }
  resetTodoDraft()
  todoInputRef.value?.blur()
}

// Same rule runLoopSchedule follows for an already-existing due Date Todo:
// it always joins Current, and — only if today's Date List already exists
// (never creates one from nothing) — also joins that. A plain todo (no
// loopInterval) never gets a focusDate here, this is Date-Todo-only.
function sendNewTodoToCurrent(todo: Todo) {
  store.sendToCurrent(todo.id)
  if (todo.loopInterval && store.hasFocusDateList(todayStr())) store.assignFocusDate(todo.id, todayStr())
}

// ── Sort: toggle between date (newest first) and A–Z ──
const sortKey = ref<'createdAt' | 'title'>('createdAt')
function toggleSort() {
  sortKey.value = sortKey.value === 'createdAt' ? 'title' : 'createdAt'
}

// ── List view toggle (desktop, overview only) ──
const listView = ref(false)
provide('listView', listView)

// ── Settings toggle ──
// Returns to whichever of the three main views was actually open before —
// not hardcoded to Overview — so the X shortcut (and the Settings button
// itself) always lands back where you came from.
function toggleSettings() {
  showMobileTags.value = false
  if (route.path === '/settings') router.push(lastMainViewPath)
  else router.push('/settings')
}

// ── Calendar toggle ──
// Same pattern as toggleSettings above: Calendar sits outside the Tab
// cycle (viewOrder is just Overview/Current now), so the C shortcut toggles
// it on/off, returning to whichever of the two you came from.
function toggleCalendar() {
  showMobileTags.value = false
  if (route.path === '/calendar') router.push(lastMainViewPath)
  else router.push('/calendar')
}

// ── Mobile tag panel ──
const showMobileTags = ref(false)

provide('activeTagIds', activeTagIds)
provide('loopFilterMode', loopFilterMode)
provide('effectiveFilterTagIds', effectiveFilterTagIds)
provide('sortKey', sortKey)

// Shared with Current.vue: the desktop "lists" button lives inside Current.vue
// itself, but the tablet/phone trigger buttons for it live here in App.vue
// (icon rail / bottom nav, outside the RouterView) — same provide/inject
// pattern as sortKey/listView above, just the other direction (a view
// reading a ref App.vue owns vs. one App.vue reads back).
const listsPanelOpen = ref(false)
provide('listsPanelOpen', listsPanelOpen)

// ── Current-view sidebar: Current/Today/Tomorrow + upcoming Date Lists ──
// viewingDate now lives here (not in Current.vue) since the desktop sidebar
// buttons that drive it sit in App.vue, outside the RouterView — same
// provide/inject direction as listsPanelOpen above.
const viewingDate = ref<string | null>(null)
provide('viewingDate', viewingDate)

// Date math shared by every Date-List nav rendering (this file's own
// Current variant below, FocusDateNav.vue's Overview variant, and the
// tablet slide-in panel) — see useFocusDateNav's own comment.
const { hasTodayList, hasTomorrowList, presetWeekDates, upcomingFocusDates, formatPresetDate, formatUpcomingDate } = useFocusDateNav()

// Overview and Current share one "currently focused Date List" concept —
// tapping back and forth between them (Tab, nav icons, ...) carries
// whichever date was selected across instead of losing your place: leaving
// Current for Overview with a Date List open hands that date to the
// Focus-Date-Pille (themeStore.selectedFocusDate), and arriving at Current
// from Overview opens whatever date the pille was already pointed at. Only
// Current's own "current" pool (viewingDate === null) has no Overview
// equivalent to sync, so it's simply left alone. viewingDate itself is
// never reset elsewhere either — a Settings or Calendar detour leaves it
// exactly as it was, so coming back to Current (directly, or via Overview)
// still shows whatever list you were last on. Gated on dateListsEnabled —
// without the feature, Current has no UI to set viewingDate itself (its
// sidebar date-nav doesn't even render), so this sync should stay quiet
// too, rather than silently opening a Date List view nobody asked for off
// a stale, persisted selectedFocusDate.
watch(() => route.path, (path, prevPath) => {
  if (!themeStore.dateListsEnabled) return
  if (prevPath === '/current' && path === '/all') {
    if (viewingDate.value) themeStore.setSelectedFocusDate(viewingDate.value)
  } else if (prevPath === '/all' && path === '/current') {
    viewingDate.value = themeStore.selectedFocusDate
  }
})

// ── Scroll dividers ──
const mainContentRef = useTemplateRef<HTMLElement>('mainContent')
const contentInnerRef = useTemplateRef<HTMLElement>('contentInner')
const bottomSpacerRef = useTemplateRef<HTMLElement>('bottomSpacer')
const {
  scrolled: isScrolled,
  scrolledToBottom: isScrolledToBottom,
  spacerHeight: mainContentSpacerHeight,
  check: checkScrollState,
} = useScrollTracking({ scrollEl: mainContentRef, contentEl: contentInnerRef, spacerEl: bottomSpacerRef, targetGap: 60 })

function onScroll() { checkScrollState() }

// ── Sidebar scroll divider ──
const sidebarRef = ref<HTMLElement | null>(null)
const sidebarScrolled = ref(false)
function onSidebarScroll() {
  sidebarScrolled.value = (sidebarRef.value?.scrollTop ?? 0) > 0
}

// ── Mobile tags panel scroll divider ──
const tagsPanelRef = ref<HTMLElement | null>(null)
const tagsListInnerRef = useTemplateRef<HTMLElement>('tagsListInner')
const tagsBottomSpacerRef = useTemplateRef<HTMLElement>('tagsBottomSpacer')
const {
  scrolled: tagsPanelScrolled,
  scrolledToBottom: tagsPanelScrolledToBottom,
  spacerHeight: tagsPanelSpacerHeight,
  check: checkTagsPanelScrollState,
} = useScrollTracking({ scrollEl: tagsPanelRef, resizeTarget: tagsListInnerRef, spacerEl: tagsBottomSpacerRef, targetGap: 44 })
function onTagsPanelScroll() { checkTagsPanelScrollState() }

watch(showMobileTags, (open) => {
  if (open && tagsPanelRef.value) tagsPanelRef.value.scrollTop = 0
  tagsPanelScrolled.value = false
  if (open) nextTick(checkTagsPanelScrollState)
})

watch(() => route.path, () => {
  const el = mainContentRef.value
  if (el) el.scrollTop = 0
  if (sidebarRef.value) sidebarRef.value.scrollTop = 0
  nextTick(checkScrollState)
})
</script>

<template>
  <div
    id="app"
    :class="{
      'is-settings': route.path === '/settings',
      'is-calendar': route.path === '/calendar',
      'is-current': route.path === '/current',
      'mobile-tags-open': showMobileTags,
    }"
  >

    <!-- ══ DESKTOP: Sidebar head — Overview-only: Focus-Date-Pille (moved
         here from the right column, see .sidebar-right below for what took
         its old spot). Every other route renders nothing here — this used
         to show an inert, grayed-out copy of the tag-filter row on
         Current/Settings/Calendar (dimmed via #app.is-current/is-settings/
         is-calendar .sidebar-head), which was leftover chrome nobody
         actually needed once those views got their own left-sidebar
         content (Date-List nav, or nothing at all). ══ -->
    <div class="sidebar-head desktop-only">
      <div v-if="route.path === '/all'" class="sidebar-focus-date-slot">
        <FocusDateWidget v-if="themeStore.dateListsEnabled" />
      </div>
    </div>

    <!-- ══ Main head: add todo input (hidden on settings + mobile-tags-open) ══ -->
    <div class="main-head">
      <div class="main-head-inner">
        <!-- Sort buttons + the mobile/tablet tag-panel toggle, grouped
             together (see .tablet-left-cluster in tablet.css) so tablet's
             grid can treat them as one left-hand block — needed for
             .top-nav's view icons to actually center across the *whole*
             row (grid-template-columns: 1fr auto 1fr only truly centers
             the middle column if each flanking column is a single,
             equal-width track; two separate auto-sized tracks on the left
             throw that off). .sort-nav keeps its original desktop
             position via `order: -1` (see layout.css) — this wrapper is
             `display:contents` outside the tablet breakpoint, so moving it
             here in the template has no visual effect on desktop besides
             that. -->
        <div class="tablet-left-cluster">
          <div v-if="route.path === '/all'" class="sort-nav desktop-only">
            <button
              ref="sortListBtnRef"
              :title="listView ? 'Switch to grid view' : 'Switch to list view'"
              class="sort-btn"
              @click="listView = !listView"
            >
              <component :is="listView ? LayoutGrid : LayoutList" :size="22" />
            </button>
            <button
              ref="sortOrderBtnRef"
              :title="sortKey === 'createdAt' ? 'By date – switch to A–Z' : 'A–Z – switch to date'"
              class="sort-btn"
              @click="toggleSort"
            >
              <ArrowUpDown :size="22" />
            </button>
          </div>

          <!-- Mobile/Tablet: tag panel toggle, or direct All/Priority toggle
               when tags are off — but in Current, tags are always inert (see
               #app.is-current's own dimming rules), so this slot shows the
               subs expand-toggle instead whenever Subs are enabled, taking
               priority over both other variants. -->
          <div
            v-if="route.path === '/current' && themeStore.subsEnabled"
            class="mobile-subs-toggle mobile-only"
          >
            <span class="mobile-subs-label">subs</span>
            <button
              type="button"
              class="mobile-subs-switch"
              role="switch"
              :aria-checked="themeStore.expandCurrentSubs"
              :class="{ on: themeStore.expandCurrentSubs }"
              @click="themeStore.toggleExpandCurrentSubs()"
            >
              <span class="mobile-subs-switch-knob" />
            </button>
          </div>
          <button
            v-else-if="themeStore.tagsEnabled"
            class="mobile-tags-btn mobile-only"
            title="Tags"
            @click="showMobileTags = true"
          >
            <Tag :size="22" />
          </button>
          <button
            v-else
            class="mobile-tags-btn priority-toggle-btn mobile-only"
            :class="{ active: activeTagIds.includes(PRIORITY_TAG_ID) }"
            :title="activeTagIds.includes(PRIORITY_TAG_ID) ? 'Showing prio – tap for all' : 'Showing all – tap for prio'"
            @click="toggleTag(PRIORITY_TAG_ID)"
          >
            <Flag :size="22" :fill="activeTagIds.includes(PRIORITY_TAG_ID) ? 'currentColor' : 'none'" />
          </button>
        </div>

        <!-- Add todo input row — tablet only, Overview's date-picker pill
             sits directly right of the input itself (see .tablet-input-row
             in tablet.css, `display:contents` outside that breakpoint so
             this wrapper has no effect on desktop/phone). -->
        <div class="tablet-input-row">
          <div class="add-wrapper" :class="{ 'add-wrapper--open': showTagModal && addTagModalTags.length }">
            <input
              ref="todoInputRef"
              v-model="todoInput"
              class="add-input"
              placeholder="todo + enter"
              @focus="onTodoFocus"
              @input="onTodoInput"
              @blur="onTodoBlur"
              @keydown.enter.prevent="addTodo"
              @keydown.escape="onTodoInputEscape"
              @keydown="onTodoTitleTabKeydown"
            />
            <button
              v-if="todoInput.length"
              type="button"
              class="add-input-clear"
              title="Clear"
              @mousedown.prevent="clearTodoInput"
            >
              <X :size="12" />
            </button>
            <div v-if="showTagModal && addTagModalTags.length" class="add-tag-row">
              <Transition :css="false" @enter="onQuickExpandEnter" @leave="onQuickExpandLeave">
                <div v-if="newTodoTagIds.includes(LOOP_TAG_ID)" class="add-loop-row">
                  <LoopPicker v-model="newTodoLoopInterval" @focus-inside="keepTodoModalOpen" />
                </div>
              </Transition>

              <div v-if="themeStore.subsEnabled" class="add-subs-row">
                <div v-if="newTodoSubs.length" class="add-subs-list">
                  <span v-for="(sub, i) in newTodoSubs" :key="i" class="add-sub-chip">
                    {{ sub }}
                    <button type="button" class="add-sub-chip-x" title="Remove" @mousedown.prevent="newTodoSubs.splice(i, 1)">
                      <X :size="9" />
                    </button>
                  </span>
                </div>
                <input
                  ref="newSubInputRef"
                  v-model="newSubDraft"
                  class="add-sub-input"
                  placeholder="sub + enter"
                  @focus="keepTodoModalOpen"
                  @keydown="onSubDraftKeydown"
                />
              </div>

              <label
                v-for="tag in addTagModalTags"
                :key="tag.id"
                class="tag-row-opt"
                :class="{ checked: newTodoTagIds.includes(tag.id), dimmed: newTodoTagIds.length > 0 && !newTodoTagIds.includes(tag.id) }"
                @mousedown.prevent
              >
                <input type="checkbox" :checked="newTodoTagIds.includes(tag.id)" @change="newTodoTagIds = newTodoTagIds.includes(tag.id) ? newTodoTagIds.filter(i => i !== tag.id) : [...newTodoTagIds, tag.id]" />
                <span>{{ tag.label }}</span>
              </label>
            </div>
          </div>
          <div v-if="themeStore.dateListsEnabled && route.path === '/all'" class="tablet-input-focus-date-widget-slot">
            <FocusDateWidget panel />
          </div>
        </div>

        <!-- Desktop nav icons — also the tablet grid's true center column
             (grid-area: center, see tablet.css). Flanked by
             .tablet-left-cluster and .tablet-header-right, both sized
             1fr, so this stays centered across the *whole* row width
             regardless of how wide either side's own content is —
             plain justify-self:center against a row that also contains
             unrelated left-side content can't do that (that's what
             previously left the icons packed next to tags/sort instead
             of centered). -->
        <nav class="top-nav desktop-only">
          <RouterLink ref="allNavRef" to="/all" class="nav-icon" title="All todos">
            <PoolIcon :size="27" />
          </RouterLink>
          <RouterLink ref="focusNavRef" to="/current" class="nav-icon" title="current">
            <Sun :size="27" />
          </RouterLink>
          <RouterLink ref="calendarNavRef" to="/calendar" class="nav-icon" title="Calendar">
            <CalendarDays :size="27" />
          </RouterLink>
        </nav>

        <!-- Tablet-width only — real desktop shows Settings in its own
             .settings-head, so it stays hidden there (see
             .tablet-settings-btn in layout.css). Current's Lists button
             (the Overview date-picker pill moved to .tablet-left-cluster,
             see above) centers itself in whatever space is left before
             Settings (see .tablet-header-right in tablet.css) — not
             centered against the row as a whole. -->
        <div class="tablet-header-right">
          <div class="tablet-header-right-center">
            <button
              v-if="themeStore.dateListsEnabled && route.path === '/current'"
              class="tablet-focus-date-widget-slot nav-icon"
              title="lists"
              @click="listsPanelOpen = true"
            >
              <ListChecks :size="22" />
            </button>
          </div>
          <button
            class="tablet-settings-btn settings-btn"
            :class="{ active: route.path === '/settings' }"
            title="Settings"
            @click="toggleSettings"
          >
            <Settings :size="26" />
          </button>
        </div>
      </div>

      <!-- Phone only — sits right at .main-head's own bottom edge (same
           "position:absolute; top:100%" trick already used for the
           add-todo tag dropdown, see .add-tag-row in layout.css), which
           lands it directly below the scroll-divider line since that's
           exactly where .main-content (and its sticky divider) begins
           too. .main-head is itself `position:sticky` (mobile.css), so
           this rides along with it while the list scrolls underneath —
           no fixed pixel offset computed or guessed anywhere. -->
      <div v-if="themeStore.dateListsEnabled && route.path === '/all'" class="phone-focus-date-widget mobile-only">
        <FocusDateWidget />
      </div>
    </div>

    <!-- ══ DESKTOP: Sidebar body — Overview + Current both show the
         Date-List nav here now (Overview's tag filters moved to the right,
         see .sidebar-right below) ══ -->
    <aside
      v-if="(route.path === '/current' || route.path === '/all') && themeStore.dateListsEnabled"
      ref="sidebarRef"
      class="sidebar desktop-only"
      @scroll="onSidebarScroll"
    >
      <ScrollDivider class="sidebar-scroll-divider" :visible="sidebarScrolled" />

      <!-- Current view: Date-List navigation switches which date's list is
           being viewed (viewingDate). today/tomorrow plus the rest of the
           7-day preset window (presetWeekDates) are always selectable, even
           empty — dimmed (not disabled) just signals nothing's on them yet,
           same as Overview's own preset row below. Anything beyond that
           window still only shows up once something's actually planned on
           it (upcomingFocusDates). -->
      <div v-if="route.path === '/current'" class="tag-list">
        <button
          class="all-btn date-nav-btn"
          :class="{ active: viewingDate === null }"
          @click="viewingDate = null"
        >
          current
        </button>
        <button
          class="all-btn date-nav-btn"
          :class="{ active: viewingDate === todayStr(), dimmed: !hasTodayList }"
          @click="viewingDate = todayStr()"
        >
          today
        </button>
        <button
          class="all-btn date-nav-btn loop-btn"
          :class="{ active: viewingDate === tomorrowStr(), dimmed: !hasTomorrowList }"
          @click="viewingDate = tomorrowStr()"
        >
          tomorrow
        </button>

        <div
          v-for="dateStr in presetWeekDates.slice(2)"
          :key="dateStr"
          class="tag-chip date-nav-upcoming-chip"
          :class="{ active: viewingDate === dateStr, dimmed: !store.hasFocusDateList(dateStr) }"
        >
          <span class="tag-label date-nav-upcoming-btn" @click="viewingDate = dateStr">{{ formatPresetDate(dateStr) }}</span>
        </div>

        <div
          v-for="dateStr in upcomingFocusDates"
          :key="dateStr"
          class="tag-chip date-nav-upcoming-chip"
          :class="{ active: viewingDate === dateStr }"
        >
          <span class="tag-label date-nav-upcoming-btn" @click="viewingDate = dateStr">{{ formatUpcomingDate(dateStr) }}</span>
        </div>
      </div>

      <!-- Overview: same Date-List nav, but picking a date sets the
           Focus-Date-Pille's target (themeStore.selectedFocusDate) instead
           of switching which list is being viewed — Overview always shows
           the full pool, there's nothing here to "view" per date. See
           FocusDateNav.vue — also reused by the tablet slide-in panel
           (FocusDatePanel.vue) below. -->
      <FocusDateNav v-else-if="route.path === '/all'" />
    </aside>

    <!-- ══ DESKTOP: Sidebar body, right column — Overview's tag filters,
         moved here from the left (see .sidebar above for what took their
         old spot). Always shows All/Prio/Date; tag chips + the
         plus-icon-expandable tag input only when tags are enabled. ══ -->
    <aside
      v-if="route.path === '/all'"
      class="sidebar sidebar-right desktop-only"
    >
      <div class="tag-list">
        <button
          ref="allBtnSidebarRef"
          class="all-btn"
          :class="{ active: effectiveFilterTagIds.length === 0, dimmed: effectiveFilterTagIds.length > 0 }"
          @click="clearAllFilters"
        >
          all
        </button>

        <button
          ref="prioBtnSidebarRef"
          class="all-btn priority-btn"
          :class="{ active: effectiveFilterTagIds.includes(PRIORITY_TAG_ID), dimmed: effectiveFilterTagIds.length > 0 && !effectiveFilterTagIds.includes(PRIORITY_TAG_ID) }"
          @click="toggleTag(PRIORITY_TAG_ID)"
        >
          prio
        </button>

        <button
          ref="loopBtnSidebarRef"
          class="all-btn loop-btn"
          :class="{ 'loop-filter-default': loopFilterMode === 'default', active: loopFilterMode === 'only', dimmed: loopFilterMode === 'hide' }"
          @click="cycleLoopFilter"
        >
          date
        </button>

        <template v-if="themeStore.tagsEnabled">
          <div class="tag-add-row">
            <button
              v-if="!tagInputOpen"
              ref="tagAddBtnRef"
              type="button"
              class="tag-add-btn"
              title="Add tag"
              @click="openTagInput"
            >
              <Plus :size="12" />
            </button>
            <Transition name="tag-input-grow">
              <input
                v-if="tagInputOpen"
                ref="tagInputRef"
                v-model="tagInput"
                class="tag-new-input tag-new-input--inline"
                placeholder="tag, ... + enter"
                @keydown="handleTagKey"
                @blur="onTagInputBlur"
              />
            </Transition>
          </div>

          <div
            v-for="tag in store.userTags"
            :key="tag.id"
            class="tag-chip"
            :class="{
              active: effectiveFilterTagIds.includes(tag.id),
              dimmed: effectiveFilterTagIds.length > 0 && !effectiveFilterTagIds.includes(tag.id)
            }"
          >
            <span class="tag-label" @click="toggleTag(tag.id)">{{ tag.label }}</span>
            <button class="tag-x" title="Delete" @click="handleDeleteTag(tag.id, tag.label)">×</button>
          </div>
        </template>
      </div>
    </aside>

    <!-- ══ DESKTOP: Settings head ══ (hidden on tablet — see
         .tablet-focus-date-widget-slot/.tablet-settings-btn below for its
         tablet-width equivalent, positioned inside main-head-inner's own
         grid instead so it can share exact centering math with the
         widget) ══ -->
    <div class="settings-head desktop-only">
      <button
        ref="settingsBtnRef"
        class="settings-btn"
        :class="{ active: route.path === '/settings' }"
        title="Settings"
        @click="toggleSettings"
      >
        <Settings :size="30" />
      </button>
    </div>

    <!-- ══ MOBILE: Tag panel (full screen, replaces main-head + content) ══ -->
    <template v-if="themeStore.tagsEnabled">
    <Transition name="tags-panel">
    <div v-show="showMobileTags" ref="tagsPanelRef" class="mobile-tags-panel mobile-only" @scroll="onTagsPanelScroll">
      <div class="mobile-tags-head">
        <input
          v-model="tagInput"
          class="tag-new-input"
          placeholder="tag, ... + enter"
          @keydown="handleTagKey"
        />
        <button class="nav-icon back-btn" title="Back" @click="showMobileTags = false">
          <CircleArrowDown :size="24" />
        </button>

        <div class="mobile-all-priority-row">
          <button
            class="all-btn"
            :class="{ active: effectiveFilterTagIds.length === 0, dimmed: effectiveFilterTagIds.length > 0 }"
            @click="clearAllFilters"
          >
            all
          </button>

          <button
            class="all-btn priority-btn"
            :class="{ active: effectiveFilterTagIds.includes(PRIORITY_TAG_ID), dimmed: effectiveFilterTagIds.length > 0 && !effectiveFilterTagIds.includes(PRIORITY_TAG_ID) }"
            @click="toggleTag(PRIORITY_TAG_ID)"
          >
            prio
          </button>

          <button
            class="all-btn loop-btn"
            :class="{ 'loop-filter-default': loopFilterMode === 'default', active: loopFilterMode === 'only', dimmed: loopFilterMode === 'hide' }"
            @click="cycleLoopFilter"
          >
            date
          </button>
        </div>

        <ScrollDivider class="tags-scroll-divider" :visible="tagsPanelScrolled" />
      </div>

      <div ref="tagsListInner" class="tag-list mobile-tag-list">
        <div class="mobile-tag-chip-wrap">
          <div
            v-for="tag in store.userTags"
            :key="tag.id"
            class="tag-chip"
            :class="{
              active: effectiveFilterTagIds.includes(tag.id),
              dimmed: effectiveFilterTagIds.length > 0 && !effectiveFilterTagIds.includes(tag.id)
            }"
          >
            <span class="tag-label" @click="toggleTag(tag.id)">{{ tag.label }}</span>
            <button class="tag-x" title="Delete" @click="handleDeleteTag(tag.id, tag.label)">×</button>
          </div>
        </div>
        <div ref="tagsBottomSpacer" class="bottom-breathing-spacer" :style="{ height: tagsPanelSpacerHeight + 'px' }" />
      </div>
    </div>
    </Transition>
    <ScrollDivider v-if="showMobileTags" class="tags-scroll-divider-bottom mobile-only" :visible="!tagsPanelScrolledToBottom" />
    </template>

    <!-- ══ Main content ══ -->
    <main ref="mainContent" class="main-content" @scroll="onScroll">
      <ScrollDivider class="scroll-divider" :visible="isScrolled" />
      <div ref="contentInner" class="content-inner">
        <RouterView />
        <div v-if="route.path !== '/calendar'" ref="bottomSpacer" class="bottom-breathing-spacer" :style="{ height: mainContentSpacerHeight + 'px' }" />
      </div>
    </main>

    <!-- ══ MOBILE: Bottom scroll divider (above bottom nav) ══ -->
    <ScrollDivider class="scroll-divider-bottom mobile-only" :visible="!isScrolledToBottom" />

    <!-- ══ MOBILE: Bottom nav ══ -->
    <nav class="mobile-bottom-nav mobile-only">
      <button
        v-if="route.path === '/all'"
        class="sort-btn"
        :title="sortKey === 'createdAt' ? 'By date – switch to A–Z' : 'A–Z – switch to date'"
        @click="toggleSort"
      >
        <ArrowUpDown :size="22" />
      </button>
      <!-- Phone-width only (see .sort-btn/.lists-btn CSS in mobile.css) —
           same bottom-left slot the sort button uses on /all, reused here
           for Current's own "browse other Date Lists" entry point since it's
           otherwise unused on /focus. -->
      <button
        v-else-if="route.path === '/current' && themeStore.dateListsEnabled"
        class="sort-btn lists-btn"
        title="lists"
        @click="listsPanelOpen = true"
      >
        <ListChecks :size="22" />
      </button>
      <div v-else class="sort-btn" style="visibility: hidden" />

      <div class="mobile-nav-views">
        <RouterLink to="/all" class="nav-icon" title="All todos" @click="showMobileTags = false">
          <PoolIcon :size="24" />
        </RouterLink>
        <RouterLink to="/current" class="nav-icon" title="current" @click="showMobileTags = false">
          <Sun :size="24" />
        </RouterLink>
        <RouterLink to="/calendar" class="nav-icon" title="Calendar" @click="showMobileTags = false">
          <CalendarDays :size="24" />
        </RouterLink>
      </div>

      <button
        class="settings-btn"
        :class="{ active: route.path === '/settings' }"
        title="Settings"
        @click="toggleSettings"
      >
        <Settings :size="24" />
      </button>
    </nav>

  </div>

  <!-- Desktop-only: keyboard shortcuts are disabled below DESKTOP_BREAKPOINT
       (see onGlobalKeydown), so this hint is meaningless below it too. -->
  <div class="shortcuts-corner-hint">press Y for shortcuts</div>

  <!-- Y held: dims the screen like the delete-confirmation backdrop, then
       floats each shortcut's key above its own control (positions computed
       in computeShortcutHints — see App.vue script). -->
  <template v-if="shortcutHintsVisible">
    <div class="shortcuts-backdrop" />
    <div
      v-for="hint in shortcutHints"
      :key="hint.key"
      class="shortcut-hint"
      :class="{ 'shortcut-hint--right': hint.anchor === 'right' }"
      :style="{ left: hint.x + 'px', top: hint.y + 'px' }"
    >{{ hint.key }}</div>

    <!-- Enter's own row (see enterHintPos/enterFollowupParts) — the key
         itself plus its follow-up keys once a card is open, boxed keys
         with a plain arrow/parenthetical label between them instead of
         one crowded pill. -->
    <div
      v-if="enterHintPos"
      class="shortcut-hint-row"
      :style="{ left: enterHintPos.x + 'px', top: enterHintPos.y + 'px' }"
    >
      <span
        v-for="(part, i) in enterFollowupParts"
        :key="i"
        :class="`shortcut-hint-${part.kind}`"
      >{{ part.text }}</span>
    </div>

    <!-- Calendar's arrow-key navigation (see calendarHintPos/calendarHintParts). -->
    <div
      v-if="calendarHintPos"
      class="shortcut-hint-row"
      :style="{ left: calendarHintPos.x + 'px', top: calendarHintPos.y + 'px' }"
    >
      <span
        v-for="(part, i) in calendarHintParts"
        :key="i"
        :class="`shortcut-hint-${part.kind}`"
      >{{ part.text }}</span>
    </div>

    <!-- Current's S (expand-subs switch) — a plain pill like the header
         shortcuts, just floated over its own measured target instead of
         the shared header line (see expandSubsHintPos). -->
    <div
      v-if="expandSubsHintPos"
      class="shortcut-hint"
      :style="{ left: expandSubsHintPos.x + 'px', top: expandSubsHintPos.y + 'px' }"
    >S</div>
  </template>

  <!-- Toast bubbles -->
  <div
    v-for="toast in toasts"
    :key="toast.id"
    class="toast"
    :class="{ 'toast--dup-tag': toast.dupTag }"
    :style="{ left: toast.left, top: toast.top }"
  >{{ toast.label }}</div>

  <!-- Delete tag confirmation modal -->
  <template v-if="deleteConfirm">
    <div class="modal-backdrop" @click="deleteConfirm = null" />
    <div class="modal-box" role="dialog">
      <p class="modal-text">Delete tag <strong>{{ deleteConfirm.label }}</strong>? It is still assigned to some todos.</p>
      <div class="modal-actions">
        <button class="modal-btn modal-btn--cancel" @click="deleteConfirm = null">Cancel</button>
        <button class="modal-btn modal-btn--delete" @click="confirmDeleteTag">Delete</button>
      </div>
    </div>
  </template>
</template>

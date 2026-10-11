<script setup lang="ts">
import { computed, ref, inject, nextTick, watch, type Component } from 'vue'
import type { Ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Check, CheckCheck, Clock, Pencil, ArrowUp, Minus, Ellipsis } from '@lucide/vue'
import { useTodosStore, PRIORITY_TAG_ID } from '../stores/todos'
import { useChecksStore, type Check as CheckItem } from '../stores/checks'
import { useThemeStore } from '../stores/theme'
import TodoCard from '../components/TodoCard.vue'
import CheckModal from '../components/CheckModal.vue'
import AllChecksModal from '../components/AllChecksModal.vue'
import ListsPanel from '../components/ListsPanel.vue'
import IconLabelButton from '../components/IconLabelButton.vue'
import { assignFonts } from '../composables/useTodoFonts'
import { useListFlip } from '../composables/useListFlip'
import { burstCheckbox, burstSparks } from '../composables/useCheckboxBurst'
import { simulateYesterdayLeftovers, SIMULATE_YESTERDAY_ENABLED } from '../dev/simulateYesterday'
import { todayStr, addDaysStr, endOfDayIso } from '../composables/useToday'
import { shrinkFontToFit } from '../composables/useFitFont'

const store = useTodosStore()
const checksStore = useChecksStore()
const themeStore = useThemeStore()
const router = useRouter()

// Shared with App.vue's tablet/phone "Lists" trigger buttons (outside the
// RouterView) — see App.vue's own provide for why this goes the opposite
// direction of sortKey/listView.
const listsPanelOpen = inject<Ref<boolean>>('listsPanelOpen')!

// Priority (with or without loop) floats to the top; everything else —
// loop or plain — sorts by when it was actually sent to Current (oldest
// addition first), not by how recently it was created.
function rank(t: { tags: string[] }): number {
  return t.tags.includes(PRIORITY_TAG_ID) ? 0 : 1
}

// Current is deliberately unfilterable — it's already the curated, small
// subset by design, and always shows every todo that's in it regardless
// of whatever All/Prio/Loop/tag filter happens to be active in Overview
// (see App.vue's #app.is-current rules, which gray out that whole filter
// UI here instead of just silently ignoring it).
const defaultCurrentTodos = computed(() => {
  return [...store.currentTodos].sort((a, b) => {
    const rankDiff = rank(a) - rank(b)
    if (rankDiff !== 0) return rankDiff
    // Falls back to createdAt for todos already in Current from before
    // focusAddedAt existed.
    return (a.focusAddedAt ?? a.createdAt).localeCompare(b.focusAddedAt ?? b.createdAt)
  })
})

// null = the default Current list above. Set from App.vue's desktop sidebar
// Date-List nav, or via ListsPanel.vue's picker on tablet/phone — swaps
// this whole view for one other Date List's todos instead of stacking it
// in a separate cramped overlay. Owned by App.vue (its sidebar buttons sit
// outside the RouterView), injected here like listsPanelOpen above.
const viewingDate = inject<Ref<string | null>>('viewingDate')!

const displayedTodos = computed(() => {
  if (!viewingDate.value) return defaultCurrentTodos.value
  return [...store.todosForFocusDate(viewingDate.value)].sort((a, b) => {
    const rankDiff = rank(a) - rank(b)
    if (rankDiff !== 0) return rankDiff
    return a.createdAt.localeCompare(b.createdAt)
  })
})

// Only today's own Date List (if viewing one) behaves like real Current —
// any other day is still in the future, so Done/Done-for-now stay
// locked (see TodoCard.vue's previewLocked) until it actually arrives.
const viewingLockedDate = computed(() => !!viewingDate.value && viewingDate.value !== todayStr())

// Same pattern as Calendar.vue's own planThisDay() — points the Focus-Date-
// Pille at this list's date and jumps to Overview, ready to swipe/assign
// todos onto it without a separate date-picker step. Only offered while
// actually viewing a Date List (not the default Current pool, which has
// its own add-todo input right at the top of the app already).
function planInOverview() {
  if (!viewingDate.value) return
  themeStore.setSelectedFocusDate(viewingDate.value)
  router.push('/all')
}

function onListSelected(dateStr: string | null) {
  viewingDate.value = dateStr
  listsPanelOpen.value = false
}

const fontMap = computed(() => assignFonts(displayedTodos.value.map(t => t.id)))
const siblingIds = computed(() => displayedTodos.value.map(t => t.id))

useListFlip(() => siblingIds.value, '.todo-wrap')

// Current and a Date List are independent (see stores/todos.ts), so which one this
// affects depends on which one is actually being viewed. Named removeCard,
// not removeFromCurrent, to not collide with the store action of that name
// this calls in the default (non-Date-List) branch.
//
// Branches on viewingDate, not viewingLockedDate (same as doneForNow
// below) — displayedTodos itself is driven by todosForFocusDate whenever
// any Date List is being viewed, today's included, so removing a card from
// *that* list has to unassign the focus date regardless of whether today
// counts as "locked". Using viewingLockedDate here used to leave today's
// own Date List calling plain removeFromCurrent instead — which only
// flips inCurrent, a flag todosForFocusDate never even looks at, so the
// card just stayed put.
function removeCard(id: string) {
  if (viewingDate.value) store.unassignFocusDate(id, viewingDate.value)
  else store.removeFromCurrent(id)
}

// Current and a Date List are independent lists (see stores/todos.ts) — a
// card's "done for now" here has to affect whichever one is actually
// being viewed, not always Current's own inCurrent-based version.
function doneForNow(id: string) {
  if (viewingDate.value) store.doneForNowOnDate(id, viewingDate.value)
  else store.doneForNow(id)
}

// ── Yesterday's leftovers ──
// Opt-in (Settings, Date Lists only): plain todos left unfinished on
// yesterday's Date List, shown below today's own list as pale one-liners
// — styled like Checks, not like cards, so they read as an offer, not a
// second list that has to be cleared. Untouched ones simply drop into the
// pool a day later (see stores/todos.ts's rolloverExpiredFocusDates).
const yesterdayStr = computed(() => addDaysStr(todayStr(), -1))
// Temporary dev-only test helper (off by default, see SIMULATE_YESTERDAY_ENABLED) next to "add todos" (see
// dev/simulateYesterday.ts), on today's list — where the leftovers section
// shows up. Not gated on the yesterday setting: that lives per device
// (localStorage), so a click switches it on too instead of the button
// silently missing on a phone where it's still off.
const showSimulateYesterday = computed(() =>
  SIMULATE_YESTERDAY_ENABLED && import.meta.env.DEV && themeStore.dateListsEnabled && viewingDate.value === todayStr()
)

function simulateYesterday() {
  if (!themeStore.yesterdayLeftoversEnabled) themeStore.toggleYesterdayLeftovers()
  simulateYesterdayLeftovers()
}

const leftovers = computed(() =>
  themeStore.dateListsEnabled && themeStore.yesterdayLeftoversEnabled && viewingDate.value === todayStr()
    ? store.leftoversFrom(yesterdayStr.value)
    : []
)

// Each title in its own todo font, same as on a card — assignFonts over
// this little list keeps the "no two neighbors alike" rule within it.
const leftoverFontMap = computed(() => assignFonts(leftovers.value.map(t => t.id)))

// Phone: the ellipsis rides at the end of the title's last line — when a
// title just about fills its line, the icon would drop onto a line of its
// own. Such a title shrinks a little (shared shrinkFontToFit) until the
// icon fits back in behind it. Desktop/tablet show the icon trio beside
// the text instead (compact toggle hidden), nothing to fit there.
const leftoverFrameRef = ref<HTMLElement | null>(null)

function iconOnLastLine(title: HTMLElement, icon: HTMLElement): boolean {
  const lines = title.getClientRects()
  if (!lines.length) return true
  const r = icon.getBoundingClientRect()
  return (r.top + r.bottom) / 2 < lines[lines.length - 1].bottom
}

function fitLeftoverTitles() {
  const frame = leftoverFrameRef.value
  if (!frame) return
  for (const item of frame.querySelectorAll<HTMLElement>('.leftover-item')) {
    const title = item.querySelector<HTMLElement>('.leftover-title')
    const icon = item.querySelector<HTMLElement>('.leftover-actions--compact')
    if (!title || !icon) continue
    if (!icon.offsetParent) { title.style.fontSize = ''; continue }
    shrinkFontToFit(title, () => iconOnLastLine(title, icon))
  }
}

// Refit on width changes only (rotation, resize) — the frame's height also
// moves with each fit and during the leave animations, which would just
// re-run this for nothing. Content changes (titles, fonts, fonts finishing
// loading) are covered separately.
watch(leftoverFrameRef, (frame, _, onCleanup) => {
  if (!frame) return
  let lastWidth = -1
  const observer = new ResizeObserver(entries => {
    const width = entries[0].contentRect.width
    if (width === lastWidth) return
    lastWidth = width
    fitLeftoverTitles()
  })
  observer.observe(frame)
  document.fonts?.ready.then(fitLeftoverTitles)
  onCleanup(() => observer.disconnect())
})
watch(() => [leftovers.value.map(t => t.title).join('\n'), leftoverFontMap.value], () => nextTick(fitLeftoverTitles))

// Both backdated so the calendar files them under yesterday, the day they
// actually belonged to. Done-for-now leaves the todo in the pool, same as
// it would have from yesterday's list itself.
// Each action plays its own little exit before the row goes (see
// onLeftoverLeave): 'today' winds up and shoots off upward toward today's
// list, 'pool' the same off to the left, 'done' pops in a spark burst
// right after the one at the clicked button. The kind (and a stagger
// index for the bulk actions) is put on the row first and rendered,
// *then* the store action removes it — the TransitionGroup's leave hook
// reads it off the element's last render.
type LeaveKind = 'done' | 'today' | 'pool'
// A bulk action's rows share one group: each exits on its own (staggered),
// but none collapses individually — the last one to finish its exit
// collapses the whole section once for all of them (see onLeftoverLeave),
// instead of the box shrinking in several small steps.
interface LeaveGroup { pending: number; settled: Promise<void>; settle: () => void }
const leaving = ref<Record<string, { kind: LeaveKind; index: number; group?: LeaveGroup }>>({})

// The open options row (if it's one of these) stays open on purpose — it
// leaves together with its row instead of snapping shut first, which made
// the whole page jump up by its height right at the click.
async function leaveThen(ids: string[], kind: LeaveKind, run: (id: string) => void) {
  let group: LeaveGroup | undefined
  if (ids.length > 1) {
    let settle!: () => void
    const settled = new Promise<void>(resolve => { settle = resolve })
    group = { pending: ids.length, settled, settle }
  }
  ids.forEach((id, index) => { leaving.value[id] = { kind, index, group } })
  await nextTick()
  ids.forEach(run)
}

// The whole box shrinks into its top-left corner — the frame itself (so
// its pale border and shadow shrink with it, rather than getting clipped
// off), narrower and shorter at the same time, while the heading row above
// fades out and folds away and the section's top margin closes up. The
// (already faded-out) rows inside are taken out of the frame's layout
// first, so its size is free to animate all the way down to nothing.
function collapseSection(section: HTMLElement): Promise<unknown> {
  const head = section.querySelector<HTMLElement>('.leftovers-head')
  const frame = section.querySelector<HTMLElement>('.leftover-frame')
  const list = frame?.querySelector<HTMLElement>('.leftover-list')
  const opts = { duration: COLLAPSE_MS, easing: 'ease-in-out', fill: 'forwards' } as const
  const anims: Animation[] = []

  if (frame) {
    const frameStyle = getComputedStyle(frame)
    const from = {
      width: `${frame.offsetWidth}px`,
      height: `${frame.offsetHeight}px`,
      padding: frameStyle.padding,
      opacity: '1',
    }
    if (list) {
      list.style.position = 'absolute'
      list.style.visibility = 'hidden'
    }
    anims.push(frame.animate([
      from,
      { ...from, width: '0px', height: '0px', padding: '0px', opacity: '1', offset: 0.85 },
      { width: '0px', height: '0px', padding: '0px', opacity: '0' },
    ], opts))
  }
  if (head) {
    head.style.overflow = 'hidden'
    anims.push(head.animate([
      { height: `${head.offsetHeight}px`, marginBottom: getComputedStyle(head).marginBottom, opacity: 1 },
      { opacity: 0, offset: 0.4 },
      { height: '0px', marginBottom: '0px', opacity: 0 },
    ], opts))
  }
  anims.push(section.animate(
    [{ marginTop: getComputedStyle(section).marginTop }, { marginTop: '0px' }],
    opts,
  ))
  return Promise.all(anims.map(a => a.finished))
}

function burst(el?: HTMLElement) {
  if (el && themeStore.celebrationsEnabled) burstCheckbox(el)
}

function completeLeftover(id: string, el?: HTMLElement) {
  burst(el)
  leaveThen([id], 'done', id => store.completeTodo(id, endOfDayIso(yesterdayStr.value)))
}

function doneForNowLeftover(id: string, el?: HTMLElement) {
  burst(el)
  leaveThen([id], 'done', id => store.doneForNowOnDate(id, yesterdayStr.value, endOfDayIso(yesterdayStr.value)))
}

function moveLeftoverToToday(id: string) {
  leaveThen([id], 'today', id => store.moveFocusDateToNextDay(id, yesterdayStr.value))
}

function releaseLeftover(id: string) {
  leaveThen([id], 'pool', id => store.releaseToPool(id, yesterdayStr.value))
}

// The heading row's bulk versions of the two above — every leftover at
// once, leaving one after the other.
function moveAllLeftoversToToday() {
  leaveThen(leftovers.value.map(t => t.id), 'today', id => store.moveFocusDateToNextDay(id, yesterdayStr.value))
}

function releaseAllLeftovers() {
  leaveThen(leftovers.value.map(t => t.id), 'pool', id => store.releaseToPool(id, yesterdayStr.value))
}

// Exit first, collapse only once it's fully done: the row's height
// closes up together with the list gap it leaves behind, so neighbors
// close up smoothly instead of jumping the last 20px when it's removed.
// The very last row to go collapses the whole section instead (heading,
// frame, its top margin) — otherwise all of that vanished at once at the
// end, and the page jumped by it whenever it was scrolled to the bottom.
//
// today/pool: a short wind-up a few px the other way, then accelerating
// away (ease-in per segment). done: a beat after the clicked button's
// own burst (completeLeftover), the row puffs up and pops in a bigger
// burst of sparks from its own center (sparks only with celebrations on;
// the pop itself always plays).
const DONE_POP_DELAY = 140
// Unhurried, so the page settles smoothly when the shrinking content makes
// it scroll back up (scrolled to the bottom).
const COLLAPSE_MS = 280

function exitKeyframes(kind: LeaveKind): Keyframe[] {
  if (kind === 'done') {
    return [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(1.06)', opacity: 1, offset: 0.35, easing: 'ease-in' },
      { transform: 'scale(0.7)', opacity: 0 },
    ]
  }
  const [windUp, away] = kind === 'today'
    ? ['translateY(3px)', 'translateY(-40px)']
    : ['translateX(5px)', 'translateX(-70px)']
  return [
    { transform: 'none', opacity: 1, easing: 'ease-out' },
    { transform: windUp, opacity: 1, offset: 0.3, easing: 'cubic-bezier(0.55, 0, 0.9, 0.4)' },
    { transform: away, opacity: 0 },
  ]
}

async function onLeftoverLeave(el: Element, done: () => void) {
  const e = el as HTMLElement
  const id = e.dataset.id!
  const info = leaving.value[id] ?? { kind: 'pool', index: 0 }
  const isDone = info.kind === 'done'
  const delay = isDone ? DONE_POP_DELAY : info.index * 50
  const gap = parseFloat(getComputedStyle(e.parentElement!).rowGap) || 0
  const isLast = !e.nextElementSibling
  const isOnly = isLast && !e.previousElementSibling

  if (isDone && themeStore.celebrationsEnabled) {
    // From the title text's own center — the whole row also spans the
    // icons (and the open options row below), which pulled it off-center.
    setTimeout(() => {
      const rect = (e.querySelector('.leftover-title') ?? e).getBoundingClientRect()
      burstSparks(rect.left + rect.width / 2, rect.top + rect.height / 2, 10, 28)
    }, delay)
  }

  const exit = e.animate(exitKeyframes(info.kind), {
    duration: isDone ? 220 : 320,
    delay,
    fill: 'forwards',
  })
  await exit.finished

  const section = e.closest<HTMLElement>('.leftovers-section')
  const group = info.group
  const lastToGo = leftovers.value.length === 0 && Object.keys(leaving.value).length === 1
  let widthAnim: Animation | null = null
  if (group) {
    group.pending--
    if (group.pending === 0) {
      if (section && leftovers.value.length === 0) await collapseSection(section)
      group.settle()
    }
    await group.settled
  } else if (lastToGo && section) {
    await collapseSection(section)
  } else {
    // The section is shrink-wrapped to its widest row — if that was this
    // one, it would otherwise snap narrower the instant the row is gone.
    // Measure the width it'll settle at (this row taken out of the layout
    // for a moment, no paint in between) and ease there alongside the
    // height collapse; the explicit width is dropped again once the row
    // is really gone, handing back to fit-content at that same width.
    if (section) {
      const fromWidth = section.offsetWidth
      e.style.display = 'none'
      const toWidth = section.offsetWidth
      e.style.display = ''
      if (toWidth !== fromWidth) {
        widthAnim = section.animate(
          [{ width: `${fromWidth}px` }, { width: `${toWidth}px` }],
          { duration: COLLAPSE_MS, easing: 'ease-in-out', fill: 'forwards' },
        )
      }
    }
    await e.animate(
      [
        { height: `${e.offsetHeight}px`, marginTop: '0px', marginBottom: '0px' },
        {
          height: '0px',
          marginTop: isLast && !isOnly ? `${-gap}px` : '0px',
          marginBottom: isLast ? '0px' : `${-gap}px`,
        },
      ],
      { duration: COLLAPSE_MS, easing: 'ease-in-out', fill: 'forwards' },
    ).finished
  }
  if (openLeftover.value?.id === id) openLeftover.value = null
  delete leaving.value[id]
  done()
  widthAnim?.cancel()
}

// Keeps the section mounted while its last rows are still animating out.
const showLeftovers = computed(() => leftovers.value.length > 0 || Object.keys(leaving.value).length > 0)

// A leftover's options unfold in a small row underneath, like a card's own
// check menu — one open at a time. 'done' = the check icon (desktop/
// tablet): just the two done modes, today/pool have their own icons
// there. 'all' = the single ellipsis icon on phones, which carries every
// option in that row instead of a cramped icon trio.
type LeftoverMenu = 'done' | 'all'
const openLeftover = ref<{ id: string; menu: LeftoverMenu } | null>(null)
function toggleLeftover(id: string, menu: LeftoverMenu) {
  const open = openLeftover.value
  openLeftover.value = open?.id === id && open.menu === menu ? null : { id, menu }
}

interface LeftoverOption { key: string; icon: Component; label: string; run: (id: string, el?: HTMLElement) => void }
const LEFTOVER_DONE_OPTIONS: LeftoverOption[] = [
  { key: 'now', icon: Clock, label: 'done for now', run: doneForNowLeftover },
  { key: 'done', icon: CheckCheck, label: 'done', run: completeLeftover },
]
const LEFTOVER_ALL_OPTIONS: LeftoverOption[] = [
  ...LEFTOVER_DONE_OPTIONS,
  { key: 'today', icon: ArrowUp, label: 'to today', run: moveLeftoverToToday },
  { key: 'pool', icon: Minus, label: 'remove', run: releaseLeftover },
]

// ── Checks ──
// Below the todo list, no divider — see CLAUDE.md's Checks section for the
// full design rationale (background reminders, lower weight than a Todo).

// A Date List preview is a full preview of that day, Checks included, not
// just Todos — see CLAUDE.md's Date Lists section. checkDisplayDate powers
// both which checks show (checksDueOn) and which date isCompletedOn reads
// off; viewingLockedDate (already used for Todos' Done/Done-for-now)
// reused as-is to lock ticking a Check on a day that hasn't arrived yet.
const checkDisplayDate = computed(() => viewingDate.value ?? todayStr())
const displayedChecks = computed(() => viewingDate.value ? checksStore.checksDueOn(viewingDate.value) : checksStore.todayChecks)

function onToggleCheck(check: CheckItem, event: MouseEvent) {
  if (viewingLockedDate.value) return
  const becomingChecked = !checksStore.isCompletedOn(check, checkDisplayDate.value)
  checksStore.toggleCompletion(check.id, checkDisplayDate.value)
  if (becomingChecked && themeStore.celebrationsEnabled) {
    burstCheckbox(event.currentTarget as HTMLElement)
  }
}

// Which of the two icon buttons is currently hovered — drives the single
// shared label underneath them (see checks-action-label in the template).
const checksHover = ref<'add' | 'edit' | null>(null)

const checkModalState = ref<'add' | CheckItem | null>(null)

function openAddCheck() {
  checkModalState.value = 'add'
}

function openEditCheck(check: CheckItem) {
  checkModalState.value = check
}

function closeCheckModal() {
  checkModalState.value = null
}

// Browsing/editing every Check, not just today's due ones — the only
// place a not-currently-due check (e.g. weekly, not due this week) can be
// reached to edit or delete at all.
const showAllChecks = ref(false)

function openAllChecks() {
  showAllChecks.value = true
}

function closeAllChecks() {
  showAllChecks.value = false
}

// Swaps the browse-list for CheckModal on the same check — one overlay on
// screen at a time, same as everywhere else in the app.
function editFromAllChecks(check: CheckItem) {
  showAllChecks.value = false
  checkModalState.value = check
}
</script>

<template>
  <div class="current-view" :class="{ 'is-empty': !displayedTodos.length }">
    <div v-if="displayedTodos.length" class="todo-wrap">
      <TodoCard
        v-for="(todo, index) in displayedTodos"
        :key="todo.id"
        :data-flip-id="todo.id"
        :todo="todo"
        :font="fontMap.get(todo.id)"
        :sibling-ids="siblingIds"
        :index="index"
        :force-expand-subs="themeStore.expandCurrentSubs"
        :preview-locked="viewingLockedDate"
        mode="current"
        @remove-from-current="removeCard"
        @complete="store.completeTodo($event)"
        @done-for-now="doneForNow"
        @move-to-next-day="viewingDate && store.moveFocusDateToNextDay($event, viewingDate)"
        @delete="store.deleteTodo($event)"
      />
    </div>
    <p v-else class="empty">{{ viewingDate ? 'Nothing planned for this day.' : 'Nothing in current right now.' }}</p>

    <div
      v-if="viewingDate && themeStore.dateListsEnabled"
      class="plan-in-overview-row"
      :class="{ 'plan-in-overview-row--centered': !displayedTodos.length }"
    >
      <IconLabelButton
        :icon="Plus"
        label="add todos"
        title="add todos to this list in overview"
        :float-label="!displayedTodos.length"
        @click="planInOverview"
      />
      <IconLabelButton
        v-if="showSimulateYesterday"
        :icon="Plus"
        label="simulate yesterday"
        title="dev: put 4 pool todos on yesterday"
        :float-label="!displayedTodos.length"
        @click="simulateYesterday"
      />
    </div>

    <div v-if="showLeftovers" class="leftovers-section">
      <div class="leftovers-head">
        <span class="leftovers-heading">yesterday</span>
        <div class="leftover-actions">
          <button type="button" class="icon-circle-btn" v-tooltip="'all to today'" @click="moveAllLeftoversToToday">
            <ArrowUp :size="10" />
          </button>
          <button type="button" class="icon-circle-btn" v-tooltip="'remove all'" @click="releaseAllLeftovers">
            <Minus :size="10" />
          </button>
        </div>
      </div>
      <div ref="leftoverFrameRef" class="leftover-frame">
        <TransitionGroup tag="div" class="leftover-list" :css="false" @leave="onLeftoverLeave">
          <div v-for="todo in leftovers" :key="todo.id" :data-id="todo.id" class="leftover-item" :class="{ open: openLeftover?.id === todo.id }">
            <div class="leftover-main">
              <span class="check-label leftover-title" :style="{ fontFamily: leftoverFontMap.get(todo.id) }">{{ todo.title }}</span>
              <div class="leftover-actions leftover-actions--full">
                <button type="button" class="icon-circle-btn leftover-toggle" v-tooltip="'done yesterday'" @click="toggleLeftover(todo.id, 'done')">
                  <Check :size="10" />
                </button>
                <button type="button" class="icon-circle-btn" v-tooltip="'move to today'" @click="moveLeftoverToToday(todo.id)">
                  <ArrowUp :size="10" />
                </button>
                <button type="button" class="icon-circle-btn" v-tooltip="'back to pool'" @click="releaseLeftover(todo.id)">
                  <Minus :size="10" />
                </button>
              </div>
              <div class="leftover-actions leftover-actions--compact">
                <button type="button" class="icon-circle-btn leftover-toggle" aria-label="options" @click="toggleLeftover(todo.id, 'all')">
                  <Ellipsis :size="10" />
                </button>
              </div>
            </div>
            <div v-if="openLeftover?.id === todo.id" class="leftover-opts-row">
              <button
                v-for="(opt, i) in openLeftover.menu === 'all' ? LEFTOVER_ALL_OPTIONS : LEFTOVER_DONE_OPTIONS"
                :key="opt.key"
                type="button"
                class="leftover-opt"
                :class="{ 'modal-btn': openLeftover.menu === 'all' }"
                :style="{ '--i': i }"
                @click="opt.run(todo.id, $event.currentTarget as HTMLElement)"
              >
                <component :is="opt.icon" :size="12" /> <span>{{ opt.label }}</span>
              </button>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>

    <div v-if="themeStore.checksEnabled" class="checks-section">
      <div class="checks-header">
        <div class="checks-icons">
          <button
            type="button"
            class="icon-circle-btn"
            v-tooltip="'add check'"
            @click="openAddCheck"
            @mouseenter="checksHover = 'add'"
            @mouseleave="checksHover = null"
          >
            <Plus :size="10" />
          </button>
          <button
            v-if="checksStore.activeChecks.length"
            type="button"
            class="icon-circle-btn"
            v-tooltip="'edit checks'"
            @click="openAllChecks"
            @mouseenter="checksHover = 'edit'"
            @mouseleave="checksHover = null"
          >
            <Pencil :size="10" />
          </button>
        </div>
        <span class="icon-action-label" :class="{ visible: checksHover }">{{ checksHover === 'edit' ? 'edit checks' : 'add check' }}</span>
      </div>
      <div v-if="displayedChecks.length" class="check-row">
        <button
          v-for="check in displayedChecks"
          :key="check.id"
          type="button"
          class="check-pill"
          :class="{ done: checksStore.isCompletedOn(check, checkDisplayDate) }"
          @click="openEditCheck(check)"
        >
          <span
            class="check-box"
            :class="{ checked: checksStore.isCompletedOn(check, checkDisplayDate), locked: viewingLockedDate }"
            v-tooltip="viewingLockedDate ? 'this day hasn\'t arrived yet' : undefined"
            @click.stop="onToggleCheck(check, $event)"
          >
            <Check v-if="checksStore.isCompletedOn(check, checkDisplayDate)" :size="10" />
          </span>
          <span class="check-label">{{ check.title }}</span>
        </button>
      </div>
    </div>
  </div>

  <CheckModal
    v-if="checkModalState === 'add'"
    @close="closeCheckModal"
  />
  <CheckModal
    v-else-if="checkModalState"
    :editing="checkModalState"
    @close="closeCheckModal"
  />

  <ListsPanel
    v-if="listsPanelOpen"
    :viewing-date="viewingDate"
    @select="onListSelected"
    @close="listsPanelOpen = false"
  />

  <AllChecksModal
    v-if="showAllChecks"
    @close="closeAllChecks"
    @edit="editFromAllChecks"
  />
</template>

<style scoped>
.current-view {
  width: 100%;
  max-width: 800px;
}

.todo-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

/* Same fix as AllTodos.vue's list-view: TodoCard.vue's own .todo-card has a
   600px max-width of its own (to stop short-title cards stretching
   absurdly wide in Overview's grid) — raised (not removed) here to match
   this view's own, wider cap above, so a card still only ever gets as wide
   as its own content needs. Lives inside the child component, hence
   :deep(). */
.todo-wrap :deep(.todo-card) {
  max-width: 800px;
}

/* Pale and set back, like Calendar's empty-state messages — a placeholder,
   not content. */
.empty {
  color: var(--ink);
  opacity: 0.5;
  font-size: var(--current-aside-font-size);
  font-weight: bold;
  font-family: var(--font-playful, sans-serif);
  text-align: center;
  margin-top: 4px;
}

/* Sits right under the viewed Date List's own todos (or its "Nothing
   planned" empty state) — a quick way into Overview with this list already
   preset as the plan-ahead target. Left-aligned flush with the todo cards
   above it (.todo-wrap's own align-items:flex-start); centered under the
   (centered) empty-state text when there are no cards. */
.plan-in-overview-row {
  display: flex;
  /* Only matters while the temporary dev "simulate yesterday" button sits
     next to "add todos" — remove together with it. */
  gap: 16px;
  justify-content: flex-start;
  margin-top: 24px;
}

.plan-in-overview-row--centered {
  justify-content: center;
}

/* Generous space instead of a visual divider — Checks (and yesterday's
   leftovers) read as lower-weight background items, not a second list
   that needs separating from the todos above it. Yesterday sits a bit
   closer — it's still the same kind of thing as the todos (a list
   carried over), so on purpose not tied to Checks' value. */
.checks-section {
  margin-top: 66px;
}

.leftovers-section {
  margin-top: 48px;
}

/* Pale frame around the yesterday entries (heading sits above it,
   outside) — same pseudo + opacity trick as a Date todo card's pale body (TodoCard.vue's
   .swipe-container.loop::before), so the border dims without dimming the
   content. Fills .leftovers-section (shrink-wrapped, see below), corners
   follow rounded/square. */
.leftover-frame {
  position: relative;
  padding: 16px 20px 20px 15px;
}

.leftover-frame::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid var(--ink);
  border-radius: var(--radius);
  /* Same shadow as a Date todo card's pale body (follows the Mono/Dark
     drop-shadow setting), dimmed along with the border. */
  box-shadow: var(--card-shadow-offset) var(--card-shadow-offset) 0 var(--priority-shadow);
  opacity: 0.35;
  pointer-events: none;
}

/* Same left inset as .check-row/.checks-header below. */
/* Shrink-wrapped to the wider of its heading row and its framed entries —
   the frame fills it, so the heading row's bulk icons end flush with the
   frame's right edge. */
.leftovers-section {
  width: fit-content;
  max-width: 100%;
}

/* Heading left (same left inset as .check-row/.checks-header below), bulk
   icons right. */
.leftovers-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 0 0 16px 5px;
}

/* The section's small print — heading and the unfolded options. */
.leftovers-heading,
.leftover-opt {
  color: var(--ink);
  opacity: 0.55;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-mono, monospace);
}

/* Icons right behind the title, a little apart from it. */
.leftover-main {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

/* Done modes first, in the same order as a card's own check menu (done
   for now, then done). Wraps on a narrow phone once all four are in. */
.leftover-opts-row {
  display: flex;
  flex-wrap: wrap;
  column-gap: 16px;
}

.leftover-opt {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: opacity 0.1s;
}

/* Plain text options (desktop/tablet's done menu) — the phone's buttons
   keep .modal-btn's own border/background instead. */
.leftover-opt:not(.modal-btn) {
  padding: 8px 0 0;
  background: none;
  border: none;
}

@media (hover: hover) {
  .leftover-opt:hover {
    opacity: 0.9;
  }
}

/* The row takes its space at once (closing is instant, no Transition
   leave), and the options jump in one after the other (--i = position) —
   same springy overshoot as the Calendar's day entry (--ease-pop).
   Keyframes with only a `from` + fill-mode backwards: they settle onto the
   element's own styles afterwards, so the resting 0.55 opacity and hover
   still apply. */
.leftover-opt {
  animation: leftover-opt-pop 0.32s var(--ease-pop) backwards;
  animation-delay: calc(var(--i, 0) * 0.06s);
}

@keyframes leftover-opt-pop {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

/* The toggle icon stays lit while its options are unfolded. */
.leftover-item.open .leftover-toggle {
  opacity: 0.9;
}

/* Phones get the single ellipsis toggle instead of the icon trio. Double
   class to outrank the shared `.leftover-actions { display: flex }` rule
   further down. */
.leftover-actions.leftover-actions--compact {
  display: none;
}

@media (max-width: 700px) {
  .leftover-actions.leftover-actions--full {
    display: none;
  }

  /* Just the one ellipsis icon here, and it rides along at the end of the
     title's last line (inline flow instead of a flex row) rather than
     sitting beside the whole text block — on a wrapped title that's
     where the text actually ends, not the end of the first line. */
  .leftover-main {
    display: block;
  }

  .leftover-title {
    display: inline;
  }

  .leftover-actions.leftover-actions--compact {
    display: inline-flex;
    vertical-align: middle;
    margin-left: 8px;
    margin-top: 0;
  }

  /* Phone: the frame spans the full width (so opening a menu doesn't
     resize it), and the options turn into small buttons without icons —
     one row, sharing the width; a long label wraps inside its own button
     rather than pushing the row onto a second line. The look itself is
     the modals' own .modal-btn (hard drop shadow, layout.css), added in
     the template for the phone-only 'all' menu, filled with --bg and
     pale as a whole — plus size and type: chip-sized vertically (shared --chip-*
     tokens), in the section's small print. The gap leaves room for each
     button's shadow. */
  .leftovers-section {
    width: 100%;
  }

  .leftover-frame {
    padding-left: 12px;
    padding-right: 12px;
  }

  .leftover-opts-row {
    flex-wrap: nowrap;
    gap: 8px;
    margin-top: 12px;
    padding-bottom: 3px;
  }

  .leftover-opt.modal-btn {
    flex: 1 1 auto;
    justify-content: center;
    padding: var(--chip-padding-v) 6px;
    line-height: var(--chip-line-height);
    font-size: 13px;
    text-align: center;
    background: var(--bg);
  }

  /* Border, text and shadow all pale together via the button's own
     opacity — the same 0.55 resting/0.9 active as the rest of the
     section's small print (.leftover-opt above). */
  .leftover-opt.modal-btn:active {
    opacity: 0.9;
  }

  .leftover-opt svg {
    display: none;
  }
}

/* A step below a todo card's text at every width (tokens in base.css),
   so the leftovers stay the quieter list.
   Descendant selector to outrank .check-label's 16px further down. */
.leftover-item .leftover-title {
  font-size: calc(var(--card-font-size) - var(--leftover-font-step));
}

@media (min-width: 1025px) and (max-width: 1400px) {
  .leftover-item .leftover-title {
    font-size: calc(var(--card-font-size-narrow-desktop) - var(--leftover-font-step));
  }
}

@media (min-width: 701px) and (max-width: 1024px) {
  .leftover-item .leftover-title {
    font-size: calc(var(--card-font-size-tablet) - var(--leftover-font-step));
  }
}

@media (max-width: 700px) {
  .leftover-item .leftover-title {
    font-size: calc(var(--card-font-size-phone) - var(--leftover-font-step));
  }
}

/* Pale like an unticked .check-pill — only the title; the icons carry
   their own dim/hover opacity (.icon-circle-btn), which would otherwise
   compound with this. */
.leftover-title {
  opacity: 0.55;
  transition: opacity 0.1s;
}

@media (hover: hover) {
  .leftover-item:hover .leftover-title {
    opacity: 0.9;
  }
}

.leftover-item.open .leftover-title {
  opacity: 0.9;
}

/* Lifted a hair so the 17px circles sit level with the 16px title's
   first line instead of hanging from its top edge. */
.leftover-actions {
  flex-shrink: 0;
  margin-top: 1px;
}

/* Icons stacked directly above their own shared label instead of side by
   side — see checks-action-label below. 24px below the whole cluster to
   today's own checks (up from the plain add-btn's old 14px), since it now
   reads as its own two-line unit rather than a single inline row. */
.checks-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-left: 5px;
  margin-bottom: 24px;
}

/* One row of .icon-circle-btn icons — Checks' add/edit pair and each
   leftover's done/today/pool icons share the spacing: snug with a mouse,
   on tablet the same as a todo card's own icons, wider apart on a phone
   so a finger hits the right one. */
.checks-icons,
.leftover-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

@media (min-width: 701px) and (max-width: 1024px) {
  .checks-icons,
  .leftover-actions {
    gap: var(--card-icon-gap-tablet);
  }
}

@media (max-width: 700px) {
  .checks-icons,
  .leftover-actions {
    gap: 14px;
  }
}

/* Icon circle style (.icon-circle-btn) and the fade-in label below it
   (.icon-action-label) both live in base.css, shared with Calendar.vue's
   day-detail Add/Edit icons — same resting/hover opacity as .check-pill's
   checkboxes below, one consistent "dim, brightens on hover" treatment
   across the whole Checks UI. Which text shows ("add check" vs. "edit
   checks") is decided here via checksHover in the script. */

.check-row,
.leftover-list {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 20px;
  /* Lines Checks' left edge up with where a todo card's own drop shadow
     starts (box-shadow: 5px 5px 0 ..., see TodoCard.vue) rather than the
     card's own flush-left edge. */
  margin-left: 5px;
}

.check-pill {
  display: flex;
  /* flex-start, not center: a title long enough to wrap onto a second
     line (see .check-label) would otherwise float the checkbox in the
     vertical middle of both lines instead of level with the first one. */
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  opacity: 0.55;
  transition: opacity 0.1s;
}

@media (hover: hover) {
  .check-pill:hover {
    opacity: 0.9;
  }
}

.check-pill.done {
  opacity: 0.3;
}

.check-box {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 2px solid var(--ink);
  /* var(--radius) is 6px in rounded mode — on a box this small that's
     effectively half its size, i.e. a circle, not a rounded corner. Capped
     at 3px so it still follows the rounded/square setting (0px stays 0px)
     without going further than a corner. */
  border-radius: min(var(--radius), 3px);
  box-shadow: 2px 2px 0 var(--priority-shadow);
  color: var(--bg);
  cursor: pointer;
}

.check-box.checked {
  background: var(--ink);
}

/* Same "not due yet" lock as TodoCard's Done/Done-for-now row for a
   future Date List preview — pointer-events:none instead of a disabled
   attribute (this is a span, not a button), so the click falls through to
   the surrounding .check-pill and still opens the edit modal. */
.check-box.locked {
  cursor: default;
  pointer-events: none;
}

.check-label {
  /* No truncation — Checks stack one per line now (no fixed column width
     to fit), so the full CHECK_TITLE_MAX_LENGTH (60 chars) just gets to
     wrap onto a second line instead of being cut off. word-break matches
     TodoCard's own title rule — without it, a title long/dense enough to
     not hit a natural space before running out of row width (easy to hit
     on a narrow phone screen at the full character limit) just overflows
     straight past the screen edge instead of wrapping. */
  min-width: 0;
  word-break: break-word;
  color: var(--ink);
  font-size: 16px;
  font-weight: 600;
  font-family: var(--font-mono, monospace);
}

/* Same fix as AllTodos.vue's list-view: content-inner centers this
   800px-capped block, so its left edge drifts depending on how much wider
   than 800px the row is at a given tablet width. Pin it to the left —
   content-inner's own 20px tablet padding already matches main-head's, so
   no extra offset (an extra margin-left on top of width: 100% overflowed
   the right edge and clipped the hover puff there). Doesn't apply to the empty state — there's no
   list to align against, so it stays centered like the calendar's own
   empty-day placeholder. */
@media (min-width: 701px) and (max-width: 1024px) {
  .current-view:not(.is-empty) {
    align-self: flex-start;
  }
}
</style>

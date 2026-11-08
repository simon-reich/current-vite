<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch, inject } from 'vue'
import type { Ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { motion } from 'motion-v'
import { Plus, Pencil, Clock, Check, RefreshCw, ChevronUp } from '@lucide/vue'
import { useTodosStore, PRIORITY_TAG_ID, type Todo, type Sub } from '../stores/todos'
import { useChecksStore } from '../stores/checks'
import { useThemeStore } from '../stores/theme'
import { useScrollTracking } from '../composables/useScrollTracking'
import { todayStr, addDaysStr, localDayOf, localDateStr, MONTH_LABELS } from '../composables/useToday'
import { arrowKeyDayDelta } from '../composables/useCalendarKeys'
import UndoDoneButton from '../components/UndoDoneButton.vue'
import CalendarModeToggle from '../components/CalendarModeToggle.vue'
import CircleCheckIcon from '../components/icons/CircleCheckIcon.vue'
import DayNotes from '../components/DayNotes.vue'
import { assignFonts } from '../composables/useTodoFonts'
import ScrollDivider from '../components/ScrollDivider.vue'
import CalendarIcon from '../components/icons/CalendarIcon.vue'
import { useCheckToggle } from '../composables/useCheckToggle'

const store = useTodosStore()
const router = useRouter()
// Provided by App.vue, same ref Current.vue's own Date-List nav reads/writes
// (see App.vue's viewingDate) — the Edit button below sets it directly so
// Current opens straight into this day's list instead of its default pool.
const viewingDate = inject<Ref<string | null>>('viewingDate')!
const checksStore = useChecksStore()
const themeStore = useThemeStore()
const calendarRef = ref<any>(null)
const viewRef = ref<HTMLElement | null>(null)
const dayDetailScrollRef = ref<HTMLElement | null>(null)
const dayDetailRef = ref<HTMLElement | null>(null)
const dayDetailBottomSpacerRef = ref<HTMLElement | null>(null)
const {
  scrolled: dayDetailScrolled,
  spacerHeight: dayDetailSpacerHeight,
  check: checkDayDetailScrollState,
} = useScrollTracking({ scrollEl: dayDetailScrollRef, resizeTarget: dayDetailRef, spacerEl: dayDetailBottomSpacerRef, targetGap: 40 })

function onDayDetailScroll() {
  checkDayDetailScrollState()
  updateLogMonth()
  followLogWithCalendar()
}

// The log's "where am I" marker: month and year of the topmost group
// still in view (.log-month) — a quick reference point while scrolling
// back, since the groups themselves only name the day. Only once the log
// is actually scrolled (same moment the divider shows), not at the very
// top where it'd just repeat the obvious. Read off the DOM on scroll
// (each group carries its date), nothing to keep in sync.
// Tablet/phone: always shown — it sits next to the folded calendar there
// (see logCalOpen), the log's one header.
const logMonth = ref('')
// The topmost group's day — what the calendar unfolds to (see openLogCal).
const logTopDate = ref('')
const showLogMonth = computed(() => viewMode.value === 'log' && !!logMonth.value && (dayDetailScrolled.value || isBelowDesktopWidth.value))
function updateLogMonth() {
  const root = dayDetailScrollRef.value
  if (viewMode.value !== 'log' || !root) { logMonth.value = ''; logTopDate.value = ''; return }
  const top = root.getBoundingClientRect().top
  const group = [...root.querySelectorAll<HTMLElement>('.log-group')].find(g => g.getBoundingClientRect().bottom > top + 1)
  const dateStr = group?.dataset.date
  logTopDate.value = dateStr ?? ''
  if (!dateStr) { logMonth.value = ''; return }
  const [y, m] = dateStr.split('-').map(Number)
  logMonth.value = `${MONTH_LABELS[m - 1]} ${y}`
}

const selectedDate = ref<string>(todayStr())

// 'log' swaps the month grid + day detail for a flat list of every Done
// todo (see logGroups below) — the calendar's own "look back" area, so no
// separate route or nav entry. Owned by App.vue (see CalendarModeToggle.vue).
const viewMode = inject<Ref<'calendar' | 'log'>>('calendarViewMode')!
// Tablet and phone, log mode: the calendar box folds shut to a small
// ink-filled icon box, the log's month marker next to it — two columns
// side by side (tablet) or a calendar pinned over the log (phone) leave
// the log too little room. Tapping it unfolds the box into the calendar,
// on the month the log is currently at. It's a navigator there: picking a
// day folds it back (the log is then at that day), and so does its own
// fold icon. Paging months or scrolling the log leaves it open — folding
// on scroll was tried and felt abrupt. Desktop keeps the calendar out
// regardless (CSS-only, the fold isn't shown there).
const isBelowDesktopWidth = inject<Ref<boolean>>('isBelowDesktopWidth')!
const logCalOpen = ref(false)
watch(viewMode, () => { logCalOpen.value = false })
function openLogCal() {
  logCalOpen.value = true
  calendarRef.value?.move(new Date((logTopDate.value || selectedDate.value) + 'T12:00:00'))
}

// Phone: the line above the bottom nav, ink while there's more to scroll
// to — the same divider (and class, mobile.css) as App.vue's own, which
// stays blank here since the page itself never scrolls on this route.
// What scrolls is the board's stack — calendar mode only: the log scrolls
// inside its own box, nothing runs past its edge. The stack's children
// are watched too, so content growing or shrinking (another day) re-checks,
// not just scrolling.
const boardRestRef = ref<HTMLElement | null>(null)
const boardScrollEl = computed(() => boardRestRef.value)
const boardScrolledToBottom = ref(true)
function checkBoardBottom() {
  const el = boardScrollEl.value
  boardScrolledToBottom.value = !el || el.scrollTop + el.clientHeight >= el.scrollHeight - 2
}
let boardResizeObserver: ResizeObserver | null = null
watch(boardScrollEl, (el) => {
  boardResizeObserver?.disconnect()
  checkBoardBottom()
  if (!el) return
  boardResizeObserver = new ResizeObserver(checkBoardBottom)
  boardResizeObserver.observe(el)
  for (const child of el.children) boardResizeObserver.observe(child)
}, { flush: 'post' })
onBeforeUnmount(() => boardResizeObserver?.disconnect())

// The notes box sits under the calendar, except on the phone: there the
// calendar is pinned, so the notes go last in the scrolling stack instead.
const isPhoneWidth = inject<Ref<boolean>>('isPhoneWidth')!

onMounted(async () => {
  await nextTick()
  calendarRef.value?.move(new Date(todayStr() + 'T12:00:00'))
  viewRef.value?.focus()
})

onBeforeRouteLeave(() => {
  selectedDate.value = todayStr()
})

function shiftDate(days: number) {
  selectedDate.value = addDaysStr(selectedDate.value, days)
  calendarRef.value?.move(new Date(selectedDate.value + 'T12:00:00'))
}

function onKeydown(e: KeyboardEvent) {
  // Typing in the notes box: the arrows move the caret there.
  if (e.target instanceof HTMLTextAreaElement) return
  const delta = arrowKeyDayDelta(e.key)
  if (delta === null) return
  e.preventDefault()
  shiftDate(delta)
}

// One plain dot for any activity on a day — a Todo done/worked on or a
// Check ticked alike, no separate dot per kind.
const activeDates = computed(() => {
  const days = new Set<string>()
  store.todos.forEach(t => {
    if (t.completedAt) days.add(localDayOf(t.completedAt))
    t.workLog.forEach(ts => days.add(localDayOf(ts)))
  })
  if (themeStore.checksEnabled) {
    checksStore.checks.forEach(c => c.completedDates.forEach(d => days.add(d)))
  }
  return [...days].map(d => new Date(d + 'T12:00:00'))
})

// Future days already carrying a planned Date List (see stores/todos.ts's
// futureFocusDates) — its own dot type, outlined instead of the solid
// activity one above since nothing has actually happened on these days yet.
const plannedActiveDates = computed(() => {
  if (!themeStore.dateListsEnabled) return []
  return store.futureFocusDates.map(d => new Date(d + 'T12:00:00'))
})

// Today's fill and the selected day's outline follow Settings' corner
// style: 4px rounded (a touch tighter than --radius, these boxes are
// small), square corners in square mode.
const dayHighlightRadius = computed(() => themeStore.rounded ? '4px' : '0')

const attributes = computed(() => {
  const attrs: object[] = []
  if (selectedDate.value) {
    attrs.push({
      key: 'selected',
      highlight: {
        style: {
          backgroundColor: 'transparent',
          border: '2px solid var(--ink)',
          borderRadius: dayHighlightRadius.value,
          width: '28px',
          height: '20px',
        },
      },
      dates: new Date(selectedDate.value + 'T12:00:00'),
    })
  }
  attrs.push({
    key: 'today',
    highlight: {
      style: {
        backgroundColor: 'var(--ink)',
        borderRadius: dayHighlightRadius.value,
        width: '28px',
        height: '20px',
      },
      contentStyle: {
        color: 'var(--bg) !important',
        fontSize: '12px',
      },
    },
    dates: new Date(todayStr() + 'T12:00:00'),
  })
  if (activeDates.value.length) {
    attrs.push({ key: 'active', dot: { style: { backgroundColor: 'var(--ink)' } }, dates: activeDates.value })
  }
  if (plannedActiveDates.value.length) {
    // Outlined instead of filled — same size as the activity dot
    // (border-box), nothing has happened on these days yet.
    attrs.push({ key: 'plannedActive', dot: { style: { backgroundColor: 'transparent', border: '1px solid var(--ink)', boxSizing: 'border-box' } }, dates: plannedActiveDates.value })
  }
  return attrs
})

function onDayClick(day: { id: string }) {
  selectedDate.value = day.id
  // Tablet/phone log: the folding calendar has done its job (see logCalOpen).
  if (viewMode.value === 'log') logCalOpen.value = false
}

// Switching between calendar and log drops the picked day — back to today,
// the calendar paged back with it. Nothing about a day picked in one mode
// carries over: the log always opens at its top (today) instead of
// visibly jumping to an old pick.
watch(viewMode, async () => {
  selectedDate.value = todayStr()
  calendarRef.value?.move(new Date(todayStr() + 'T12:00:00'))
  await nextTick()
  checkDayDetailScrollState()
})

// The calendar stays next to the log too: picking a day there scrolls the
// log to it (see scrollLogTo).
watch(selectedDate, (dateStr) => {
  if (viewMode.value === 'log') scrollLogTo(dateStr, true)
})

// "Saturday, October 3, 2026" — the day detail's own heading and each of
// the log's day groups.
function formatDayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

const selectedDateLabel = computed(() => selectedDate.value ? formatDayLabel(selectedDate.value) : '')

// The log view: every Done todo (store.completedTodos, newest first, deleted
// ones left out) grouped by its completion day — same day key completedOn
// uses, so a todo sits under exactly the day the calendar shows it on.
const logGroups = computed(() => {
  const groups: { dateStr: string; label: string; todos: Todo[] }[] = []
  for (const todo of store.completedTodos) {
    const dateStr = localDayOf(todo.completedAt!)
    const last = groups[groups.length - 1]
    if (last && last.dateStr === dateStr) last.todos.push(todo)
    else groups.push({ dateStr, label: formatDayLabel(dateStr), todos: [todo] })
  }
  return groups
})

// The log only shows the last LOG_WINDOW_DAYS days (today included) at
// first; scrolling past its end widens that window in LOG_WINDOW_DAYS
// steps on its own (see logSentinelRef below) — far enough to always
// reach the next day that actually has entries, so a load never turns up
// nothing. Display-only: nothing is persisted, and switching to the log
// again starts back at one window.
const LOG_WINDOW_DAYS = 30
const logWindows = ref(1)
// Groups that came in with the latest load — they domino in (see
// .log-group--new), the ones already there stay put.
const newLogDates = ref(new Set<string>())
watch(viewMode, (mode) => {
  if (mode !== 'log') return
  logWindows.value = 1
  newLogDates.value = new Set()
})

const logCutoff = computed(() => addDaysStr(todayStr(), 1 - LOG_WINDOW_DAYS * logWindows.value))
const visibleLogGroups = computed(() => logGroups.value.filter(g => g.dateStr >= logCutoff.value))
// Newest group still hidden (groups are newest first), if any.
const nextOlderLogGroup = computed(() => logGroups.value.find(g => g.dateStr < logCutoff.value))

// How many windows the log needs to reach back to dateStr.
function logWindowsReaching(dateStr: string): number {
  const today = new Date(todayStr() + 'T12:00:00')
  const daysBack = Math.round((today.getTime() - new Date(dateStr + 'T12:00:00').getTime()) / 86_400_000)
  return Math.ceil((daysBack + 1) / LOG_WINDOW_DAYS)
}

function showOlderLog() {
  const next = nextOlderLogGroup.value
  if (!next) return
  const before = new Set(visibleLogGroups.value.map(g => g.dateStr))
  logWindows.value = logWindowsReaching(next.dateStr)
  newLogDates.value = new Set(visibleLogGroups.value.map(g => g.dateStr).filter(d => !before.has(d)))
}

// Scrolls the log to a day: its group, or — on a day with nothing Done —
// the next older one (groups are newest first). Older than the loaded
// window, the window first widens to reach it (no domino, it's a jump,
// not a load). A future day or today lands at the top.
async function scrollLogTo(dateStr: string, smooth: boolean) {
  logScrolledByUser = false
  const groups = logGroups.value
  if (!groups.length) return
  const target = groups.find(g => g.dateStr <= dateStr) ?? groups[groups.length - 1]
  if (target.dateStr < logCutoff.value) logWindows.value = logWindowsReaching(target.dateStr)
  await nextTick()
  const root = dayDetailScrollRef.value
  if (!root) return
  const behavior = smooth ? 'smooth' : 'instant'
  if (target === groups[0]) { root.scrollTo({ top: 0, behavior }); return }
  const el = root.querySelector<HTMLElement>(`.log-group[data-date="${target.dateStr}"]`)
  if (!el) return
  // Scrolls the log box only — scrollIntoView would also scroll every
  // ancestor, the page's own (otherwise pinned, see layout.css) content
  // area included. The group lands where the box's padding starts.
  const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop
  root.scrollTo({ top: top - root.clientTop - parseFloat(getComputedStyle(root).paddingTop), behavior })
}

// Calendar and log run in sync, both ways. Paging the calendar to another
// month scrolls the log there (its newest entry in that month, or the
// next older one if it has none — see scrollLogTo). Scrolling the log by
// hand into another month pages the calendar along. Only by hand
// (wheel/touch, logScrolledByUser): the log scrolling itself — to a picked
// day or a paged month — never pages the calendar, or paging to an empty
// month would land the calendar on the older month the log ended up at.
// Each side skips a month the other already shows, so neither echoes back.
const calPage = ref<{ month: number; year: number } | null>(null)
let logScrolledByUser = false

function sameMonth(dateStr: string, page: { month: number; year: number } | null) {
  if (!dateStr || !page) return false
  const [y, m] = dateStr.split('-').map(Number)
  return y === page.year && m === page.month
}

function onCalendarMove(pages: { month: number; year: number }[]) {
  const page = pages[0]
  if (!page) return
  calPage.value = { month: page.month, year: page.year }
  if (viewMode.value !== 'log' || sameMonth(logTopDate.value, page)) return
  scrollLogTo(localDateStr(new Date(page.year, page.month, 0)), true)
}

function followLogWithCalendar() {
  if (!logScrolledByUser || viewMode.value !== 'log' || !logTopDate.value) return
  if (sameMonth(logTopDate.value, calPage.value)) return
  calendarRef.value?.move(new Date(logTopDate.value + 'T12:00:00'))
}

// Scrolling the log by hand lets the calendar page along (see above).
function onLogScrolledByUser() {
  logScrolledByUser = true
}

// The log opens at its top — today (see the viewMode watcher above).
function onLogShown() {
  updateLogMonth()
}

// Domino order for a new group's label and entries: one running index
// across everything that came in with the load, so the rows tip in one
// after another top to bottom. Capped so a big load doesn't keep the last
// rows waiting for seconds.
const LOG_DOMINO_CAP = 14
const logDominoStart = computed(() => {
  const start = new Map<string, number>()
  let i = 0
  for (const g of visibleLogGroups.value) {
    if (!newLogDates.value.has(g.dateStr)) continue
    start.set(g.dateStr, i)
    i += g.todos.length + 1
  }
  return start
})
function logDomino(dateStr: string, k: number) {
  const start = logDominoStart.value.get(dateStr)
  return start === undefined ? undefined : { '--i': Math.min(start + k, LOG_DOMINO_CAP) }
}

// Endless log: the list ends in a bit of empty run-out (.log-more) you can
// scroll on into, past the last entry. Its far end carries an invisible
// marker — once that's in view, the log holds for a beat (so it reads as
// "reached the end, fetching more" rather than an unexplained stop) and
// then the next part dominoes in. Watched against the viewport (root
// null) rather than the scroll container, so it works whichever element
// actually scrolls on the current layout. Re-observed after every load:
// an observer only reports changes, so a marker that's still in view (a
// short log that doesn't fill the screen yet) would otherwise never fire
// again.
const LOG_LOAD_PAUSE_MS = 350
const logSentinelRef = ref<HTMLElement | null>(null)
const logLoading = ref(false)
let logLoadTimer: ReturnType<typeof setTimeout> | null = null
const logObserver = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver(entries => {
      if (logLoading.value || !entries.some(e => e.isIntersecting)) return
      logLoading.value = true
      logLoadTimer = setTimeout(() => {
        logLoading.value = false
        showOlderLog()
      }, LOG_LOAD_PAUSE_MS)
    })
  : null
watch([logSentinelRef, () => visibleLogGroups.value.length], async ([el]) => {
  logObserver?.disconnect()
  if (!el) return
  await nextTick()
  logObserver?.observe(el)
})
// Content changes (switching to the log, a load) move what's on top too.
watch([viewMode, () => visibleLogGroups.value.length], async () => {
  await nextTick()
  // The log fades in (unfold transition) — wait for its groups to exist.
  requestAnimationFrame(updateLogMonth)
}, { immediate: true })

onBeforeUnmount(() => {
  logObserver?.disconnect()
  if (logLoadTimer) clearTimeout(logLoadTimer)
})

const doneOnDay = computed(() => selectedDate.value ? store.completedOn(selectedDate.value) : [])
const workedOnDay = computed(() => selectedDate.value ? store.workedOn(selectedDate.value) : [])
// Subs completed this day, per parent todo — a todo can show up here even
// on a day it was never itself Done/Done-for-now (see dayEntries below),
// which is exactly why subs-only progress still lands on the calendar.
const subsOnDay = computed(() => selectedDate.value && themeStore.subsEnabled ? store.subsCompletedOn(selectedDate.value) : [])

// What's on the selected day's list — today or a future day only (a past
// day shows what was left undone instead, see missedOnDay). Everything
// todosForFocusDate counts, Date Todos due that day included: the board's
// "planned" box is the day's whole preview, same as Current shows it.
// Planned by hand first, Date Todos (due by their own schedule, see
// isDateTodo in stores/todos.ts) after them — those show pale with a clock
// instead of the dash, so they don't read as deliberately planned.
const plannedOnDay = computed(() => {
  if (!selectedDate.value || selectedDate.value < todayStr()) return []
  const all = store.todosForFocusDate(selectedDate.value)
  return [...all.filter(t => !store.isDateTodo(t)), ...all.filter(store.isDateTodo)]
})

// A past day's open leftovers — recorded at the day change (Todo.missedDates,
// see rolloverExpiredFocusDates/runLoopSchedule), never derived. Anything
// that did get done/worked on that day after all is left out.
const missedOnDay = computed(() => {
  if (!isPastDate.value) return []
  const handled = new Set(dayEntries.value.filter(e => e.kind === 'done' || e.worked).map(e => e.todo.id))
  return store.missedOn(selectedDate.value).filter(t => !handled.has(t.id))
})

// The day's Checks, one side at a time: ticked ones by default, or —
// switched to "open" — the ones due that day but not ticked, where they
// can be caught up on (ticking one moves it over to "done"). Both at once
// was too much on the board. Not persisted: the calendar always opens on
// "done", but the switch stays put while stepping through days. A Check
// created after that day never counts as due on it.
const checksMode = ref<'done' | 'open'>('done')
const checksForDay = computed(() => {
  if (!selectedDate.value || !themeStore.checksEnabled) return []
  const day = selectedDate.value
  if (checksMode.value === 'done') return checksStore.completedOn(day)
  return checksStore.checksDueOn(day).filter(c => localDayOf(c.createdAt) <= day && !checksStore.isCompletedOn(c, day))
})

const toggleCheck = useCheckToggle()

// Jumps to Overview with the widget already pointed at this day, ready to
// assign todos to it without a separate date-picker step — see
// FocusDateWidget.vue/stores/theme.ts's selectedFocusDate.
function planThisDay() {
  if (!selectedDate.value) return
  themeStore.setSelectedFocusDate(selectedDate.value)
  router.push('/all')
}

// Jumps to Current with this day's Date List already open (App.vue's own
// viewingDate, same ref its desktop sidebar Date-List nav uses) — a quick
// way to review/edit what's already planned without hunting for the date
// again over there.
function editThisDayList() {
  if (!selectedDate.value) return
  viewingDate.value = selectedDate.value
  router.push('/current')
}

// A future day has nothing done/ticked yet — only its plan box shows.
const isFutureDate = computed(() => !!selectedDate.value && selectedDate.value > todayStr())

// A past day is done — its third box shows what was left open instead of
// a plan (and no add/edit, which would plan into the past).
const isPastDate = computed(() => !!selectedDate.value && selectedDate.value < todayStr())

// Each entry keeps its own done/worked "kind" (double vs. single circle check) even
// though the day's list is no longer *grouped* by that — see dayEntries
// below. What was actually finished vs. just touched today is still worth
// showing per item, it's just not the more interesting question for a
// retrospective glance at the day. A todo that only had subs ticked today
// (never itself Done/Done-for-now) still counts as "worked" here — Done-
// for-today is about closing a todo back into the pool for later, not the
// only way of showing you touched it; ticking subs across several days is
// the same kind of progress and should read the same way in the calendar.
// `worked`: there's a real Done for now that day (a workLog entry), not
// just ticked subs — only that counts as having handled a missed todo.
interface DayEntry { todo: Todo; kind: 'done' | 'worked'; subs: Sub[]; worked: boolean }

// Merges doneOnDay/workedOnDay/subsOnDay into one entry per todo — a todo
// touched in more than one way the same day (e.g. Done *and* some subs
// ticked first) gets a single row with both its kind and its subs, instead
// of appearing twice.
const dayEntries = computed<DayEntry[]>(() => {
  const map = new Map<string, DayEntry>()
  doneOnDay.value.forEach(todo => map.set(todo.id, { todo, kind: 'done', subs: [], worked: false }))
  workedOnDay.value.forEach(todo => {
    if (!map.has(todo.id)) map.set(todo.id, { todo, kind: 'worked', subs: [], worked: true })
  })
  subsOnDay.value.forEach(({ todo, subs }) => {
    const existing = map.get(todo.id)
    if (existing) existing.subs = subs
    else map.set(todo.id, { todo, kind: 'worked', subs, worked: false })
  })
  return [...map.values()]
})

// Priority vs. everything else, not done vs. worked-on — priority is
// already the app's one first-class "this mattered" signal everywhere
// else (card fill, its own filter/sort rank in Current), so grouping by it
// here answers "did I get to the important stuff" instead of the more
// bookkeeping-flavored "did I finish it or just poke at it".
const priorityEntries = computed(() => dayEntries.value.filter(e => e.todo.tags.includes(PRIORITY_TAG_ID)))
const otherEntries = computed(() => dayEntries.value.filter(e => !e.todo.tags.includes(PRIORITY_TAG_ID)))

// TRIAL: each todo title in its own todo font, as on its card — one
// assignFonts pass over everything the board shows, in display order, so
// neighbours never share a font.
const todoFontMap = computed(() => assignFonts([
  ...priorityEntries.value, ...otherEntries.value,
].map(e => e.todo.id).concat(
  missedOnDay.value.map(t => t.id),
  plannedOnDay.value.map(t => t.id),
  visibleLogGroups.value.flatMap(g => g.todos.map(t => t.id)),
)))
function todoFont(id: string) {
  return { fontFamily: todoFontMap.value.get(id) }
}
</script>

<template>
  <div ref="viewRef" class="calendar-view" tabindex="0" @keydown="onKeydown">
    <!-- Phone only — desktop has it in App.vue's left sidebar, tablet in App.vue's header. -->
    <div class="view-toggle calendar-mode-toggle">
      <CalendarModeToggle />
    </div>

    <!-- Control board: every part of the day in its own box. Desktop:
         calendar | done + checks | planned (past: not done). Tablet: the
         calendar left, the rest stacked on the right. Phone: one column,
         the calendar pinned, the boxes scrolling under it. In log mode the
         calendar stays, the log takes the place of the other boxes. The
         placement per layout lives in the CSS (grid areas). Notes go under
         the calendar, on the phone last in the scrolling stack. -->
    <motion.div
      class="calendar-board"
      :class="{ 'calendar-board--log': viewMode === 'log', 'calendar-board--cal-closed': viewMode === 'log' && !logCalOpen }"
      :initial="{ opacity: 0, scale: 0.96 }"
      :animate="{ opacity: 1, scale: 1 }"
      :transition="{ type: 'spring', stiffness: 380, damping: 26, mass: 0.8 }"
    >
      <div class="board-col board-col--cal">
        <section class="board-box board-box--cal">
          <button v-if="viewMode === 'log'" type="button" class="cal-toggle" aria-label="show calendar" @click="openLogCal">
            <CalendarIcon :size="20" />
          </button>
          <div class="cal-collapse">
            <div class="cal-collapse-inner">
              <div class="cal">
                <VCalendar
                  ref="calendarRef"
                  :attributes="attributes"
                  expanded
                  locale="en"
                  :first-day-of-week="2"
                  @dayclick="onDayClick"
                  @did-move="onCalendarMove"
                />
              </div>
              <p v-if="viewMode === 'calendar' && !isPhoneWidth" class="day-label">{{ selectedDateLabel }}</p>
              <button v-if="viewMode === 'log'" type="button" class="icon-circle-btn cal-fold-btn" v-tooltip="'hide calendar'" @click="logCalOpen = false">
                <ChevronUp :size="12" />
              </button>
            </div>
          </div>
        </section>
        <DayNotes v-if="viewMode === 'calendar' && !isPhoneWidth" :date-str="selectedDate" @leave="viewRef?.focus()" />
      </div>

      <div v-if="viewMode === 'calendar'" ref="boardRestRef" class="board-rest" @scroll="checkBoardBottom">
        <p v-if="isPhoneWidth" class="day-label">{{ selectedDateLabel }}</p>
        <!-- A future day has nothing done or ticked yet — its plan moves up
             into this spot instead. -->
        <div v-if="!isFutureDate" class="board-col">
          <section class="board-box">
            <p class="board-box-label">done</p>
            <Transition name="unfold" mode="out-in">
              <div :key="selectedDate" class="board-box-body">
                <div v-if="dayEntries.length" class="day-items">
                  <template v-for="(group, gi) in [priorityEntries, otherEntries]" :key="gi">
                    <div v-if="gi === 1 && priorityEntries.length && otherEntries.length" class="day-group-spacer" />
                    <div v-for="entry in group" :key="entry.todo.id" class="day-entry">
                      <div class="day-item">
                        <span class="icon"><CircleCheckIcon :double="entry.kind === 'done'" :filled="gi === 0" size="1em" /></span>
                        <span class="day-item-title" :style="todoFont(entry.todo.id)">{{ entry.todo.title }}</span>
                        <span v-if="!entry.todo.deletedAt" class="day-undo-slot">
                          <UndoDoneButton :todo-id="entry.todo.id" :worked="entry.kind === 'worked'" :date-str="selectedDate" />
                        </span>
                      </div>
                      <div v-if="entry.subs.length" class="day-subs">
                        <div v-for="sub in entry.subs" :key="sub.id" class="day-sub-item"><span>–</span><span>{{ sub.title }}</span></div>
                      </div>
                    </div>
                  </template>
                </div>
                <p v-else class="no-activity">Nothing done on this day.</p>
              </div>
            </Transition>
          </section>

          <section v-if="themeStore.checksEnabled" class="board-box">
            <div class="board-box-head">
              <p class="board-box-label">{{ checksMode === 'open' ? 'open checks' : 'checks' }}</p>
              <div class="board-box-label board-box-switch">
                <button
                  type="button"
                  :class="{ active: checksMode === 'open' }"
                  v-tooltip="checksMode === 'open' ? 'show done checks' : 'show open checks'"
                  @click="checksMode = checksMode === 'open' ? 'done' : 'open'"
                >
                  <RefreshCw :size="16" />
                </button>
              </div>
            </div>
            <Transition name="unfold" mode="out-in">
              <div :key="`${selectedDate}-${checksMode}`" class="board-box-body">
                <div v-if="checksForDay.length" class="day-items">
                  <div v-for="check in checksForDay" :key="check.id" class="day-item day-item--check" :class="{ done: checksMode === 'done' }">
                    <span class="icon icon--check"><span class="check-box" :class="{ checked: checksMode === 'done' }" @click="toggleCheck(check, selectedDate, $event.currentTarget as HTMLElement)"><Check v-if="checksMode === 'done'" :size="10" /></span></span>
                    <span class="day-item-title">{{ checksMode === 'done' ? checksStore.titleOn(check, selectedDate) : check.title }}</span>
                  </div>
                </div>
                <p v-else class="no-activity">{{ checksMode === 'done' ? 'No checks done on this day.' : 'Nothing left open.' }}</p>
              </div>
            </Transition>
          </section>
        </div>

        <div class="board-col">
          <section class="board-box">
            <p class="board-box-label">{{ isPastDate ? 'not done' : 'planned' }}</p>
            <Transition name="unfold" mode="out-in">
              <div :key="selectedDate" class="board-box-body">
                <template v-if="isPastDate">
                  <div v-if="missedOnDay.length" class="day-items">
                    <div v-for="todo in missedOnDay" :key="todo.id" class="day-item day-item--open">
                      <span class="day-item-bullet">–</span><span class="day-item-title" :style="todoFont(todo.id)">{{ todo.title }}</span>
                    </div>
                  </div>
                  <p v-else class="no-activity">Nothing left open.</p>
                </template>
                <template v-else>
                  <div v-if="plannedOnDay.length" class="day-items">
                    <div v-for="todo in plannedOnDay" :key="todo.id" class="day-item" :class="{ 'day-item--date': store.isDateTodo(todo) }">
                      <span v-if="store.isDateTodo(todo)" class="icon icon--clock"><Clock /></span>
                      <span v-else class="day-item-bullet">–</span>
                      <span class="day-item-title" :style="todoFont(todo.id)">{{ todo.title }}</span>
                    </div>
                  </div>
                  <p v-else class="no-activity">Nothing planned yet.</p>

                  <div v-if="themeStore.dateListsEnabled" class="day-actions">
                    <span
                      class="icon-side-label"
                      :class="plannedOnDay.length ? 'icon-side-label--left' : 'icon-side-label--right'"
                    >
                      <span class="icon-side-label-text">add</span>
                      <button type="button" class="icon-circle-btn" v-tooltip="'plan this day in overview'" @click="planThisDay">
                        <Plus :size="10" />
                      </button>
                    </span>
                    <span v-if="plannedOnDay.length" class="icon-side-label icon-side-label--right">
                      <button type="button" class="icon-circle-btn" v-tooltip="'edit this day\'s list in current'" @click="editThisDayList">
                        <Pencil :size="10" />
                      </button>
                      <span class="icon-side-label-text">edit</span>
                    </span>
                  </div>
                </template>
              </div>
            </Transition>
          </section>
        </div>

        <DayNotes v-if="isPhoneWidth" :date-str="selectedDate" @leave="viewRef?.focus()" />
      </div>

      <div v-else class="board-log">
        <!-- The log's month marker: desktop right above the box, tablet/
             phone next to the folded calendar (see the CSS at the end). -->
        <div class="log-month-row">
          <Transition name="log-month" mode="out-in">
            <span v-if="showLogMonth" :key="logMonth" class="log-month">{{ logMonth }}</span>
          </Transition>
        </div>

        <div ref="dayDetailScrollRef" class="board-box day-detail-scroll" @scroll="onDayDetailScroll" @wheel.passive="onLogScrolledByUser" @touchmove.passive="onLogScrolledByUser">
          <div ref="dayDetailRef" class="day-detail">
            <transition
              name="unfold"
              @after-enter="onLogShown"
              appear
              appear-active-class="unfold-appear-active"
              appear-from-class="unfold-appear-from"
            >
              <div class="day-detail-content">
                <template v-if="logGroups.length">
                  <p v-if="!visibleLogGroups.length" class="no-activity">Nothing completed in the last {{ LOG_WINDOW_DAYS }} days.</p>
                  <div v-for="group in visibleLogGroups" :key="group.dateStr" :data-date="group.dateStr" class="log-group" :class="{ 'log-group--new': newLogDates.has(group.dateStr) }">
                    <p class="board-box-label" :style="logDomino(group.dateStr, 0)">{{ group.label }}</p>
                    <div class="day-items">
                      <div v-for="(todo, i) in group.todos" :key="todo.id" class="day-item" :style="logDomino(group.dateStr, i + 1)">
                        <span class="icon"><CircleCheckIcon double :filled="todo.tags.includes(PRIORITY_TAG_ID)" size="1em" /></span>
                        <span class="day-item-title" :style="todoFont(todo.id)">{{ todo.title }}</span>
                        <span class="day-undo-slot"><UndoDoneButton :todo-id="todo.id" /></span>
                      </div>
                    </div>
                  </div>
                  <div v-if="nextOlderLogGroup" class="log-more" aria-hidden="true">
                    <div ref="logSentinelRef" class="log-sentinel" />
                  </div>
                </template>
                <p v-else class="no-activity">Nothing completed yet.</p>
              </div>
            </transition>

            <div ref="dayDetailBottomSpacerRef" class="bottom-breathing-spacer" :style="{ height: dayDetailSpacerHeight + 'px' }" />
          </div>
        </div>
      </div>
    </motion.div>

    <!-- Outside the board: its entrance animation scales it, which would
         pin a fixed element to the board instead of the viewport. -->
    <ScrollDivider class="scroll-divider-bottom mobile-only" :visible="!boardScrolledToBottom" />
  </div>
</template>

<style scoped>
/* ── Board ── The view itself fills the (non-scrolling, see layout.css)
   content area; each column scrolls on its own where it has to. */
.calendar-view {
  /* Space between boxes, and the room left around them for their drop
     shadow (offset right + down) — a scrolling column clips anything past
     its edge, so it pads that much on those two sides. */
  --board-gap: 28px;
  --board-shadow-room: var(--card-shadow-offset);
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  outline: none;
}

/* Desktop: calendar with notes under it | done + checks | planned (a
   future day's plan moves into done's place). The log spans both
   right-hand columns, so the calendar keeps its width switching modes. On
   very wide screens the board stops growing and sits centered, instead
   of stretching edge to edge. */
.calendar-board {
  --board-cal-col: minmax(300px, 1fr);
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 1600px;
  margin-inline: auto;
  display: grid;
  grid-template-columns: var(--board-cal-col) 1fr 1fr;
  grid-template-rows: minmax(0, 1fr);
  grid-template-areas: "cal rest rest";
  gap: var(--board-gap);
}

.calendar-board--log {
  grid-template-areas: "cal log log";
}

.board-col--cal { grid-area: cal; }
.board-rest { grid-area: rest; }
.board-log { grid-area: log; }

.board-rest {
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--board-gap);
}

.board-col {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--board-gap);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 var(--board-shadow-room) calc(var(--board-shadow-room) + var(--board-gap)) 0;
  scrollbar-width: none;
}

.board-col::-webkit-scrollbar {
  display: none;
}


.board-col--cal {
  overflow: visible;
}

/* The notes fill the calendar column below the calendar; the text
   scrolls inside. No frame at all, just the label and the text — but the
   box keeps the room a shadowed one takes, out to where its shadow would
   end, so its edges line up with the shadows around it. Doubled class so
   it wins over .board-box further down. */
.board-box.board-box--notes {
  flex: 1;
  min-height: 140px;
  border-color: transparent;
  box-shadow: none;
  margin-right: calc(-1 * var(--board-shadow-room));
  margin-bottom: calc(-1 * var(--board-shadow-room));
  padding-bottom: calc(var(--board-box-pad-bottom) + var(--board-shadow-room));
}

/* One box per part of the day — the same surface as a todo card: ink
   border, the app's hard drop shadow, corners from Settings. */
.board-box {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  --board-box-pad-bottom: 18px;
  padding: 16px 18px var(--board-box-pad-bottom);
  background: var(--bg);
  border: 2px solid var(--ink);
  border-radius: var(--radius);
  box-shadow: var(--card-shadow-offset) var(--card-shadow-offset) 0 var(--ink);
}

/* The gap between grid and day label sits on the folding content, not the
   box: folded shut (tablet/phone log), nothing of it may stay behind. */
.board-box--cal {
  gap: 0;
  padding: 10px 10px 16px;
}

.board-box--cal .cal-collapse-inner {
  gap: 10px;
}

.board-box-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* A box's title (done / checks / planned …) and the log's day labels.
   :deep for DayNotes.vue's label. */
.calendar-view :deep(.board-box-label) {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
  opacity: 0.5;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-family: var(--font-mono, monospace);
}

/* A box head with a switch on the right (checks: done ↔ open, a
   two-arrow "other side" icon that turns half a round per flip). The switch sits in the label's own paleness; off ("done") it's
   paler again on top of that, on ("open", label then reads "open checks")
   it reads like the label itself. */
.board-box-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.board-box-switch {
  display: flex;
}

.board-box-switch button {
  display: flex;
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.1s;
}

.board-box-switch button.active {
  opacity: 1;
}

.board-box-switch svg {
  transition: transform 0.3s var(--ease-pop, ease);
}

.board-box-switch button.active svg {
  transform: rotate(180deg);
}

@media (hover: hover) {
  .board-box-switch button:hover {
    opacity: 1;
  }
}

/* ── Calendar grid ── */
/* A wrapper, not a class on VCalendar itself: VCalendar renders a fragment,
   so its root never gets this component's scope attribute and scoped
   (:deep) rules on it would never match. The grid's look lives globally in
   calendar.css; only the phone's compact sizes are set here. */
.cal {
  width: 100%;
  flex-shrink: 0;
}

/* The selected day, under the grid it was picked in. On the phone it
   heads the scrolling stack instead (see the template), so it scrolls up
   with the boxes rather than taking room in the pinned calendar. */
.day-label {
  flex-shrink: 0;
  text-align: center;
  font-size: 17px;
  font-weight: 600;
  color: var(--ink-dark);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-family: var(--font-playful, sans-serif);
}

/* Tablet/phone log mode only (see the media block at the end): the
   calendar box folded shut — a small ink-filled square, just the calendar
   icon in --bg. Tapping it unfolds the same box into the calendar; the
   fold icon under the grid folds it back. */
.cal-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
}

/* The calendar's content, folding away (0fr ↔ 1fr) — only in use on
   tablet/phone log mode. */
.cal-collapse {
  display: grid;
  grid-template-rows: 1fr;
}

.cal-collapse-inner {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.cal-fold-btn {
  display: none;
  align-self: center;
}

/* ── Entries ── */
.calendar-view {
  /* An entry's text size and the gap after its icon — shared by .day-item
     itself and .day-subs' indent, which has to clear exactly that icon
     column (the icon is 1em of this size, see .icon). */
  --day-item-font-size: 16px;
  --day-item-icon-gap: 9px;
  --day-sub-font-size: 13px;
}

.day-items {
  /* The undo button gets its own column at the right edge: every entry
     (and its subs) keeps that column free, whether or not it has a button
     itself — so long titles all wrap at the same edge. */
  --day-undo-col: calc(var(--icon-circle-btn-size) + var(--day-item-icon-gap));
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 6px;
}

.day-entry {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.day-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--day-item-icon-gap);
  font-size: var(--day-item-font-size);
  font-weight: bold;
  color: var(--ink);
  font-family: var(--font-playful, sans-serif);
}

.day-item,
.day-subs {
  padding-right: var(--day-undo-col);
}

/* Takes the rest of the row so an undo button after it sits at the far
   right, and a wrapped second line stays under the title. */
.day-item-title {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

/* Own flex item rather than inline text — a wrapped second line then lines
   up under the title, not under the dash. */
.day-item-bullet {
  flex-shrink: 0;
}

/* Completed subs for that same day, nested under their parent todo,
   indented past the icon column. */
.day-subs {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: calc(var(--day-item-font-size) + var(--day-item-icon-gap));
  opacity: 0.65;
}

.day-sub-item {
  display: flex;
  gap: 0.3em;
  font-size: var(--day-sub-font-size);
  font-weight: 600;
  color: var(--ink);
  font-family: var(--font-playful, sans-serif);
  word-break: break-word;
}

.day-sub-item > :first-child {
  flex-shrink: 0;
}

.day-sub-item > :last-child {
  min-width: 0;
}

.icon {
  /* 1em icon, one line-height tall — centers on the title's first line at
     any text size. */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 1lh;
  flex-shrink: 0;
  color: var(--ink);
}

/* Not done: a past day's leftover — pale, set back from what actually
   happened. Checks stay in full ink either way; their box shows ticked
   or not. */
.day-item--open {
  opacity: 0.4;
}

/* A Date Todo on a plan — due by its own schedule, not planned by hand:
   pale like Date todo cards, a clock instead of the dash. */
.day-item--date {
  opacity: 0.5;
}

/* A check, box and title, pale exactly like in Current (.check-pill):
   ticked paler than open, same shared values. */
.day-item--check {
  opacity: var(--check-opacity);
}

.day-item--check.done {
  opacity: var(--check-done-opacity);
}

/* The box around the done icons' size, not Current's 16px — they matter
   more and shouldn't be outweighed. Measured off CircleCheckIcon (1em, see
   .icon): its circle spans 22 of its 24 units, its stroke is 2 of them.
   The box takes that line width but a notch less than that size — with
   its drop shadow, a box at the circle's full size still reads heavier.
   The tick inside scales with it. */
.icon--check .check-box {
  width: calc(1em * 19 / 24);
  height: calc(1em * 19 / 24);
  border-width: calc(1em * 2 / 24);
}

/* Titles in Current's check font (.check-label: mono, 600) — at the
   entries' own size here. */
.day-item--check .day-item-title {
  font-family: var(--font-mono, monospace);
  font-weight: 600;
}

.icon--check .check-box svg {
  width: 0.55em;
  height: 0.55em;
}

/* The box is the toggle — brightens the row on hover like Current's
   .check-pill. */
.day-item--check .check-box {
  cursor: pointer;
}

@media (hover: hover) {
  .day-item--check:has(.check-box:hover) {
    opacity: var(--check-hover-opacity);
  }
}

.icon--clock :deep(svg) {
  width: 0.8em;
  height: 0.8em;
}

/* Plain space between the priority / other groups — the filled vs.
   outlined icons already tell priority apart. */
.day-group-spacer {
  height: 10px;
}

/* Undo button column, one line-height tall like .icon. */
.day-undo-slot {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  height: 1lh;
}

/* An empty box's placeholder — quieter than real entries: the subs' smaller
   size, regular weight, italic (like the notes field's placeholder). */
.no-activity {
  font-size: var(--day-sub-font-size);
  font-weight: normal;
  font-style: italic;
  color: var(--ink);
  font-family: var(--font-playful, sans-serif);
  opacity: 0.5;
}

/* Add/edit under the planned list. Icon buttons are base.css's
   .icon-circle-btn; each label unrolls sideways on hover
   (.icon-side-label), absolutely positioned, so the icons never move. */
.day-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 6px;
}

/* ── Log ── one big box, centered at reading width, scrolling inside. */
/* The log's place on the board, next to the calendar — its box scrolls
   on its own, left-aligned at a readable width. */
.board-log {
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-right: var(--board-shadow-room);
}

.day-detail-scroll {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 720px;
  margin-bottom: var(--board-gap);
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.day-detail-scroll::-webkit-scrollbar {
  display: none;
}

.day-detail,
.day-detail-content {
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 100%;
}

.log-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

/* Month + year of the log's topmost group in view (see updateLogMonth),
   hanging up out of a zero-height row above the box, right-aligned with
   it. Phone: right end of the calendar | log row instead. */
.log-month-row {
  position: relative;
  flex-shrink: 0;
  height: 0;
  width: 100%;
  max-width: 720px;
}

.log-month-row .log-month {
  position: absolute;
  bottom: 8px;
  line-height: 1;
  right: 0;
}

.log-month {
  color: var(--ink);
  font-size: var(--date-label-font-size);
  line-height: 1.2;
  font-weight: var(--date-label-font-weight);
  font-family: var(--font-playful, sans-serif);
  white-space: nowrap;
}

.log-month-enter-active,
.log-month-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.log-month-enter-from,
.log-month-leave-to {
  opacity: 0;
}

.log-month-enter-from {
  transform: translateY(4px);
}

.log-month-leave-to {
  transform: translateY(-4px);
}

/* Run-out past the last entry (see logSentinelRef) — room to scroll on
   into before the next part loads, the marker at its far end. */
.log-more {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 120px;
}

.log-sentinel {
  height: 1px;
}

/* A loaded part tips in row by row (index from logDomino). */
.log-group--new .board-box-label,
.log-group--new .day-item {
  animation: log-domino 0.34s var(--ease-pop) backwards;
  animation-delay: calc(var(--i, 0) * 45ms);
}

@keyframes log-domino {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.96);
  }
}

.unfold-enter-active,
.unfold-leave-active { transition: opacity 0.09s; }
.unfold-enter-from,
.unfold-leave-to { opacity: 0; }

/* First mount only (switching into the log) — timed to the board's own
   entrance spring. */
.unfold-appear-active { transition: opacity 0.32s var(--ease-pop), transform 0.32s var(--ease-pop); }
.unfold-appear-from { opacity: 0; transform: translateY(8px); }

/* calendar | log switch for phone — desktop shows it in App.vue's left
   sidebar, tablet in App.vue's header row instead. */
.view-toggle {
  display: none;
  justify-content: flex-start;
}

/* Narrow desktop: the calendar column is tighter. */
@media (min-width: 1025px) and (max-width: 1400px) {
  .calendar-view {
    --board-gap: 22px;
  }

  .calendar-board {
    --board-cal-col: minmax(270px, 1fr);
  }
}

/* Tablet: two equal columns — the calendar with notes under it, every
   other box stacked in one scrolling column next to it (the log alike).
   The phone below builds on this. */
@media (max-width: 1024px) {
  /* Everything a size smaller (the phone shares these) — two columns
     side by side don't have the width for the desktop sizes. */
  .calendar-view {
    --board-gap: 16px;
    --day-item-font-size: 15px;
    --day-sub-font-size: 12px;
  }

  .board-box {
    --board-box-pad-bottom: 14px;
    padding: 12px 14px var(--board-box-pad-bottom);
  }

  .board-box--cal {
    padding: 4px 6px 10px;
  }

  .board-box--cal .cal-collapse-inner {
    gap: 4px;
  }

  /* A step more compact grid — on the phone so it doesn't take half the
     screen before any box shows, on the tablet so it fits its column. */
  .cal :deep(.vc-header) {
    height: 26px;
    margin-top: 6px;
  }

  .cal :deep(.vc-title) {
    font-size: 19px !important;
  }

  .cal :deep(.vc-weekday) {
    font-size: 14px !important;
  }

  /* Rows tall enough to hit with a finger (~40px is the usual touch
     target); the phone trades that back for space, see below. */
  .cal :deep(.vc-day) {
    min-height: 38px;
  }

  .cal :deep(.vc-day-content) {
    width: 24px !important;
    height: 24px !important;
    line-height: 24px !important;
    font-size: 16px !important;
  }

  .day-label {
    font-size: 14px;
    font-weight: 700;
  }

  .calendar-board {
    grid-template-columns: 1fr 1fr;
    grid-template-areas: "cal rest";
  }

  .calendar-board--log {
    grid-template-areas: "cal log";
  }

  .board-rest {
    display: flex;
    flex-direction: column;
    gap: var(--board-gap);
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 var(--board-shadow-room) calc(var(--board-shadow-room) + var(--board-gap)) 0;
    scrollbar-width: none;
  }

  .board-rest::-webkit-scrollbar {
    display: none;
  }

  /* The stack scrolls as a whole, so a column keeps its full content
     height — shrunk to fit, its overflow would run into the next one. */
  .board-rest > .board-col {
    flex-shrink: 0;
    overflow: visible;
    padding: 0;
  }
}

/* Phone: one column — the calendar box stays pinned on top, the other
   boxes scroll underneath it. */
@media (max-width: 700px) {
  .view-toggle {
    display: flex;
    align-items: center;
    margin-bottom: 14px;
  }

  .log-month-row {
    display: none;
  }

  .calendar-board {
    display: flex;
    flex-direction: column;
  }

  /* The calendar's column holds only the calendar here (the notes go last
     in the stack, see the template) — room for its shadow below, the
     board's gap does the rest. */
  .board-col--cal {
    flex-shrink: 0;
    padding-right: var(--board-shadow-room);
    padding-bottom: var(--board-shadow-room);
  }

  /* Grows with the note's text (DayNotes.vue) rather than shrinking to fit
     and scrolling inside — the stack it sits in scrolls instead. */
  .board-box.board-box--notes {
    flex: 1 0 auto;
    min-height: 160px;
  }

  .cal :deep(.vc-day) {
    min-height: 28px;
  }

  .board-rest,
  .board-log {
    flex: 1;
    padding-top: 2px;
  }
}

/* Tablet and phone, log mode: the calendar box on top left, folded shut
   to a small ink-filled icon square unless logCalOpen, the log's month
   marker top right next to it, the log filling the rest. Open, the box
   grows to at most --cal-fold-max wide (a calendar stretched across a
   tablet looks off); the marker stays, its bottom level with the box's
   bottom edge (folded or open — it rides along as the box unfolds; phone:
   under the open box, see below). The
   board turns into a grid with .board-log dissolved into it (display:
   contents), so its month row can sit up there without a second copy.
   After the phone block so it wins over its rules. */
@media (max-width: 1024px) {
  .calendar-board--log {
    --cal-fold-size: 44px;
    --cal-fold-max: 360px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: "top" "log";
  }

  .calendar-board--log .board-log {
    display: contents;
  }

  .calendar-board--log .board-col--cal {
    grid-area: top;
    z-index: 1;
    flex-shrink: 0;
    padding: 0 var(--board-shadow-room) 0 0;
    overflow: visible;
  }

  .calendar-board--log .board-box--cal {
    width: var(--cal-fold-max);
    max-width: 100%;
    transition: width 0.3s ease, background-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease, padding 0.3s ease;
  }

  .calendar-board--log .cal-collapse {
    transition: grid-template-rows 0.3s ease;
  }

  .calendar-board--log .cal-collapse-inner {
    overflow: hidden;
  }

  .calendar-board--log .cal-fold-btn {
    display: flex;
  }

  .calendar-board--cal-closed .board-box--cal {
    width: var(--cal-fold-size);
    padding: 0;
    background: var(--ink);
    color: var(--bg);
    box-shadow: var(--card-shadow-offset) var(--card-shadow-offset) 0 var(--priority-shadow);
  }

  .calendar-board--cal-closed .cal-toggle {
    display: flex;
    /* The box's 2px border on either side makes up the rest. */
    height: calc(var(--cal-fold-size) - 4px);
  }

  .calendar-board--cal-closed .cal-collapse {
    grid-template-rows: 0fr;
  }

  .calendar-board--log .log-month-row {
    grid-area: top;
    align-self: end;
    display: flex;
    justify-content: flex-end;
    /* Desktop's row is 0 tall (the marker hangs above the log box there);
       here it's the marker's own height, so its bottom is the box's. */
    height: auto;
    max-width: none;
    padding-right: var(--board-shadow-room);
  }

  .calendar-board--log .log-month-row .log-month {
    position: static;
  }

  .calendar-board--log .day-detail-scroll {
    grid-area: log;
    margin-right: var(--board-shadow-room);
  }
}
/* Phone: an unfolded calendar takes the whole width — the month marker
   moves to its own row under it instead of next to it. */
@media (max-width: 700px) {
  .calendar-board--log:not(.calendar-board--cal-closed) {
    grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas: "top" "month" "log";
  }

  .calendar-board--log:not(.calendar-board--cal-closed) .log-month-row {
    grid-area: month;
  }
}
</style>

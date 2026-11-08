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
import { todoFont as todoFontFamily } from '../composables/useTodoFonts'
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
  updateArchiveMonth()
  followArchiveWithCalendar()
}

// The archive's "where am I" marker: month and year of the topmost group
// still in view (.archive-month) — a quick reference point while scrolling
// back, since the groups themselves only name the day. Only once the archive
// is actually scrolled (same moment the divider shows), not at the very
// top where it'd just repeat the obvious. Read off the DOM on scroll
// (each group carries its date), nothing to keep in sync.
// Tablet/phone: always shown — it sits next to the folded calendar there
// (see archiveCalOpen), the archive's one header.
const archiveMonth = ref('')
// The topmost group's day — what the calendar unfolds to (see openArchiveCal).
const archiveTopDate = ref('')
const showArchiveMonth = computed(() => viewMode.value === 'archive' && !!archiveMonth.value && (dayDetailScrolled.value || isBelowDesktopWidth.value))
function updateArchiveMonth() {
  const root = dayDetailScrollRef.value
  if (viewMode.value !== 'archive' || !root) { archiveMonth.value = ''; archiveTopDate.value = ''; return }
  const top = root.getBoundingClientRect().top
  const group = [...root.querySelectorAll<HTMLElement>('.archive-group')].find(g => g.getBoundingClientRect().bottom > top + 1)
  const dateStr = group?.dataset.date
  archiveTopDate.value = dateStr ?? ''
  if (!dateStr) { archiveMonth.value = ''; return }
  const [y, m] = dateStr.split('-').map(Number)
  archiveMonth.value = `${MONTH_LABELS[m - 1]} ${y}`
}

const selectedDate = ref<string>(todayStr())

// 'archive' swaps the month grid + day detail for a flat list of every Done
// todo (see archiveGroups below) — the calendar's own "look back" area, so no
// separate route or nav entry. Owned by App.vue (see CalendarModeToggle.vue).
const viewMode = inject<Ref<'journal' | 'archive'>>('calendarViewMode')!
// Tablet and phone, archive mode: the calendar box folds shut to a small
// ink-filled icon box, the archive's month marker next to it — two columns
// side by side (tablet) or a calendar pinned over the archive (phone) leave
// the archive too little room. Tapping it unfolds the box into the calendar,
// on the month the archive is currently at. It's a navigator there: picking a
// day folds it back (the archive is then at that day), and so does its own
// fold icon. Paging months or scrolling the archive leaves it open — folding
// on scroll was tried and felt abrupt. Desktop keeps the calendar out
// regardless (CSS-only, the fold isn't shown there).
const isBelowDesktopWidth = inject<Ref<boolean>>('isBelowDesktopWidth')!
const archiveCalOpen = ref(false)
watch(viewMode, () => { archiveCalOpen.value = false })
function openArchiveCal() {
  archiveCalOpen.value = true
  calendarRef.value?.move(new Date((archiveTopDate.value || selectedDate.value) + 'T12:00:00'))
}


// The notes box sits under the calendar, except on the phone: there the
// calendar is pinned, so the notes go last in the scrolling stack instead.
const isPhoneWidth = inject<Ref<boolean>>('isPhoneWidth')!

// Phone: the line above the bottom nav, ink while there's more to scroll
// to — the same divider (and class, mobile.css) as App.vue's own, which
// stays blank here since the page itself never scrolls on this route.
// What scrolls is the board's stack — journal mode only: the archive scrolls
// inside its own box, nothing runs past its edge. The stack's children
// are watched too, so content growing or shrinking (another day) re-checks,
// not just scrolling.
const boardRestRef = ref<HTMLElement | null>(null)
const boardScrollEl = computed<HTMLElement | null>(() => viewMode.value === 'archive' ? null : boardRestRef.value)
const boardScrolledToBottom = ref(true)
// Scrolled at all — the folded head's divider (phone, see .fold-head-divider).
const boardScrolled = ref(false)
function checkBoardBottom() {
  const el = boardScrollEl.value
  boardScrolledToBottom.value = !el || el.scrollTop + el.clientHeight >= el.scrollHeight - 2
  boardScrolled.value = !!el && el.scrollTop > 0
}
let boardResizeObserver: ResizeObserver | null = null
watch(boardScrollEl, (el, oldEl) => {
  boardResizeObserver?.disconnect()
  oldEl?.removeEventListener('scroll', checkBoardBottom)
  checkBoardBottom()
  if (!el) return
  el.addEventListener('scroll', checkBoardBottom, { passive: true })
  boardResizeObserver = new ResizeObserver(checkBoardBottom)
  boardResizeObserver.observe(el)
  for (const child of el.children) boardResizeObserver.observe(child)
}, { flush: 'post' })
onBeforeUnmount(() => {
  boardResizeObserver?.disconnect()
  boardScrollEl.value?.removeEventListener('scroll', checkBoardBottom)
})

// ── The calendar fold ──
// One mechanism for both places the calendar box folds into a small
// ink-filled icon square: tablet/phone archive (toggled, see archiveCalOpen) and
// phone journal mode (scroll-driven, see below). --fold on the
// calendar's column, 0 = calendar, 1 = icon square, drives everything in
// the CSS — size,
// ink fill, which content shows. The archive just sets 0 or 1 and lets it
// animate; the phone's journal mode follows the finger.
// The box's open height is measured (CSS can't interpolate from auto).
const calBoxRef = ref<HTMLElement | null>(null)
const calInnerRef = ref<HTMLElement | null>(null)
const foldOpenHeight = ref(0)
function measureFold() {
  const box = calBoxRef.value
  const inner = calInnerRef.value
  if (!box || !inner) return
  const cs = getComputedStyle(box)
  const frame = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
    .reduce((sum, k) => sum + parseFloat(cs[k as any]), 0)
  foldOpenHeight.value = inner.offsetHeight + frame
}
let foldResizeObserver: ResizeObserver | null = null
onMounted(() => {
  foldResizeObserver = new ResizeObserver(measureFold)
  if (calInnerRef.value) foldResizeObserver.observe(calInnerRef.value)
  measureFold()
})
onBeforeUnmount(() => foldResizeObserver?.disconnect())

// Phone, journal mode: scrolling the day's stack down while it's at its
// top first folds the calendar away — stepless, with the finger — and
// only then scrolls the stack; scrolling back up at its top unfolds it
// again. The first FOLD_RESIST px of finger travel only move it a little
// (FOLD_RESIST_RATE), the bit of resistance before it gives; then it
// follows 1:1 (the box's bottom edge stays under the finger). Let go
// midway and it settles in the direction it was going. Tapping the
// folded square unfolds it straight away.
const FOLD_RESIST = 40
const FOLD_RESIST_RATE = 0.25
const calFold = ref(0)
const calFoldDragging = ref(false)
watch(viewMode, () => { calFold.value = 0 })

const foldable = computed(() => foldOpenHeight.value > 0 && (viewMode.value === 'archive' ? isBelowDesktopWidth.value : isPhoneWidth.value))
const foldValue = computed(() => viewMode.value === 'archive' ? (archiveCalOpen.value ? 0 : 1) : calFold.value)
const folded = computed(() => foldable.value && foldValue.value >= 0.5)
// Set on the calendar's column and — phone journal mode — on the day's
// stack too, which slides up beside the folded square (see the CSS).
const foldClass = computed(() => ({ 'cal-foldable': foldable.value, 'cal-folded': folded.value, 'cal-fold-anim': !calFoldDragging.value }))
const foldStyle = computed(() => foldable.value ? { '--fold': foldValue.value, '--fold-open-h': `${foldOpenHeight.value}px` } : undefined)

function foldSize(): number {
  const box = calBoxRef.value
  return box ? parseFloat(getComputedStyle(box).getPropertyValue('--cal-fold-size')) || 44 : 44
}
// How far the finger has to travel (past the resistance) for a full fold.
function foldTravel(): number {
  return Math.max(1, foldOpenHeight.value - foldSize())
}
function resisted(dy: number): number {
  const a = Math.abs(dy)
  const eased = a < FOLD_RESIST ? a * FOLD_RESIST_RATE : FOLD_RESIST * FOLD_RESIST_RATE + (a - FOLD_RESIST)
  return Math.sign(dy) * eased
}
function settleFold(direction: number) {
  calFoldDragging.value = false
  const f = calFold.value
  calFold.value = direction > 0 ? (f > 0.15 ? 1 : 0) : direction < 0 ? (f < 0.85 ? 0 : 1) : Math.round(f)
}

const phoneFoldActive = () => foldable.value && viewMode.value === 'journal'
let touchStartY = 0
let touchStartFold = 0
let touchLastY = 0
let touchDirection = 0
let touchTracking: boolean | null = null
function onStackTouchStart(e: TouchEvent) {
  if (!phoneFoldActive()) return
  touchStartY = touchLastY = e.touches[0].clientY
  touchStartFold = calFold.value
  touchDirection = 0
  touchTracking = null
}
function onStackTouchMove(e: TouchEvent) {
  if (!phoneFoldActive() || touchTracking === false) return
  const stack = boardRestRef.value
  const y = e.touches[0].clientY
  const dy = touchStartY - y // > 0: finger up, i.e. scrolling down
  if (touchTracking === null) {
    const atTop = !stack || stack.scrollTop <= 0
    touchTracking = atTop && ((dy > 0 && touchStartFold < 1) || (dy < 0 && touchStartFold > 0))
    if (!touchTracking) return
  }
  e.preventDefault()
  if (y !== touchLastY) touchDirection = Math.sign(touchLastY - y)
  touchLastY = y
  calFoldDragging.value = true
  const travel = foldTravel()
  const moved = resisted(dy)
  calFold.value = Math.min(1, Math.max(0, touchStartFold + moved / travel))
  // Fully folded and still going: the rest of the stroke scrolls the stack.
  const past = moved - (1 - touchStartFold) * travel
  if (stack && past > 0) stack.scrollTop = past
}
function onStackTouchEnd() {
  if (!touchTracking) return
  touchTracking = null
  settleFold(touchDirection)
}

// Same with a mouse wheel / trackpad (a narrow desktop window), settling
// once the wheel has been still for a moment.
let wheelSettleTimer: ReturnType<typeof setTimeout> | null = null
function onStackWheel(e: WheelEvent) {
  if (!phoneFoldActive()) return
  const stack = boardRestRef.value
  const atTop = !stack || stack.scrollTop <= 0
  const f = calFold.value
  if (!atTop || !((e.deltaY > 0 && f < 1) || (e.deltaY < 0 && f > 0))) return
  e.preventDefault()
  calFoldDragging.value = true
  calFold.value = Math.min(1, Math.max(0, f + e.deltaY / foldTravel()))
  const direction = Math.sign(e.deltaY)
  if (wheelSettleTimer) clearTimeout(wheelSettleTimer)
  wheelSettleTimer = setTimeout(() => settleFold(direction), 140)
}
// Non-passive: these have to be able to keep the stack from scrolling.
watch(boardRestRef, (el, oldEl) => {
  oldEl?.removeEventListener('touchstart', onStackTouchStart)
  oldEl?.removeEventListener('touchmove', onStackTouchMove)
  oldEl?.removeEventListener('touchend', onStackTouchEnd)
  oldEl?.removeEventListener('touchcancel', onStackTouchEnd)
  oldEl?.removeEventListener('wheel', onStackWheel)
  if (!el) return
  el.addEventListener('touchstart', onStackTouchStart, { passive: true })
  el.addEventListener('touchmove', onStackTouchMove, { passive: false })
  el.addEventListener('touchend', onStackTouchEnd, { passive: true })
  el.addEventListener('touchcancel', onStackTouchEnd, { passive: true })
  el.addEventListener('wheel', onStackWheel, { passive: false })
}, { flush: 'post' })
onBeforeUnmount(() => { if (wheelSettleTimer) clearTimeout(wheelSettleTimer) })

// The folded square: archive → unfold to the archive's month; calendar → unfold.
function onFoldToggle() {
  if (viewMode.value === 'archive') openArchiveCal()
  else calFold.value = 0
}


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
  // Tablet/phone archive: the folding calendar has done its job (see archiveCalOpen).
  if (viewMode.value === 'archive') archiveCalOpen.value = false
}

// Switching between journal and archive drops the picked day — back to today,
// the calendar paged back with it. Nothing about a day picked in one mode
// carries over: the archive always opens at its top (today) instead of
// visibly jumping to an old pick.
watch(viewMode, async () => {
  selectedDate.value = todayStr()
  calendarRef.value?.move(new Date(todayStr() + 'T12:00:00'))
  await nextTick()
  checkDayDetailScrollState()
})

// The calendar stays next to the archive too: picking a day there scrolls the
// archive to it (see scrollArchiveTo).
watch(selectedDate, (dateStr) => {
  if (viewMode.value === 'archive') scrollArchiveTo(dateStr, true)
})

// "Saturday, October 3, 2026" — the day detail's own heading and each of
// the archive's day groups.
function formatDayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

const selectedDateLabel = computed(() => selectedDate.value ? formatDayLabel(selectedDate.value) : '')

// The archive view: every Done todo (store.completedTodos, newest first, deleted
// ones left out) grouped by its completion day — same day key completedOn
// uses, so a todo sits under exactly the day the calendar shows it on.
const archiveGroups = computed(() => {
  const groups: { dateStr: string; label: string; todos: Todo[] }[] = []
  for (const todo of store.completedTodos) {
    const dateStr = localDayOf(todo.completedAt!)
    const last = groups[groups.length - 1]
    if (last && last.dateStr === dateStr) last.todos.push(todo)
    else groups.push({ dateStr, label: formatDayLabel(dateStr), todos: [todo] })
  }
  return groups
})

// The archive only shows the last ARCHIVE_WINDOW_DAYS days (today included) at
// first; scrolling past its end widens that window in ARCHIVE_WINDOW_DAYS
// steps on its own (see archiveSentinelRef below) — far enough to always
// reach the next day that actually has entries, so a load never turns up
// nothing. Display-only: nothing is persisted, and switching to the archive
// again starts back at one window.
const ARCHIVE_WINDOW_DAYS = 30
const archiveWindows = ref(1)
// Groups that came in with the latest load — they domino in (see
// .archive-group--new), the ones already there stay put.
const newArchiveDates = ref(new Set<string>())
watch(viewMode, (mode) => {
  if (mode !== 'archive') return
  archiveWindows.value = 1
  newArchiveDates.value = new Set()
  fillArchiveOnOpen()
})

const archiveCutoff = computed(() => addDaysStr(todayStr(), 1 - ARCHIVE_WINDOW_DAYS * archiveWindows.value))
const visibleArchiveGroups = computed(() => archiveGroups.value.filter(g => g.dateStr >= archiveCutoff.value))
// Newest group still hidden (groups are newest first), if any.
const nextOlderArchiveGroup = computed(() => archiveGroups.value.find(g => g.dateStr < archiveCutoff.value))

// How many windows the archive needs to reach back to dateStr.
function archiveWindowsReaching(dateStr: string): number {
  const today = new Date(todayStr() + 'T12:00:00')
  const daysBack = Math.round((today.getTime() - new Date(dateStr + 'T12:00:00').getTime()) / 86_400_000)
  return Math.ceil((daysBack + 1) / ARCHIVE_WINDOW_DAYS)
}

function showOlderLog() {
  const next = nextOlderArchiveGroup.value
  if (!next) return
  const before = new Set(visibleArchiveGroups.value.map(g => g.dateStr))
  archiveWindows.value = archiveWindowsReaching(next.dateStr)
  newArchiveDates.value = new Set(visibleArchiveGroups.value.map(g => g.dateStr).filter(d => !before.has(d)))
}

// Scrolls the archive to a day: its group, or — on a day with nothing Done —
// the next older one (groups are newest first). Older than the loaded
// window, the window first widens to reach it (no domino, it's a jump,
// not a load). A future day or today lands at the top.
async function scrollArchiveTo(dateStr: string, smooth: boolean) {
  archiveScrolledByUser = false
  const groups = archiveGroups.value
  if (!groups.length) return
  const target = groups.find(g => g.dateStr <= dateStr) ?? groups[groups.length - 1]
  if (target.dateStr < archiveCutoff.value) archiveWindows.value = archiveWindowsReaching(target.dateStr)
  await nextTick()
  const root = dayDetailScrollRef.value
  if (!root) return
  const behavior = smooth ? 'smooth' : 'instant'
  if (target === groups[0]) { root.scrollTo({ top: 0, behavior }); return }
  const el = root.querySelector<HTMLElement>(`.archive-group[data-date="${target.dateStr}"]`)
  if (!el) return
  // Scrolls the archive box only — scrollIntoView would also scroll every
  // ancestor, the page's own (otherwise pinned, see layout.css) content
  // area included. The group lands where the box's padding starts.
  const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop
  root.scrollTo({ top: top - root.clientTop - parseFloat(getComputedStyle(root).paddingTop), behavior })
}

// Calendar and archive run in sync, both ways. Paging the calendar to another
// month scrolls the archive there (its newest entry in that month, or the
// next older one if it has none — see scrollArchiveTo). Scrolling the archive by
// hand into another month pages the calendar along. Only by hand
// (wheel/touch, archiveScrolledByUser): the archive scrolling itself — to a picked
// day or a paged month — never pages the calendar, or paging to an empty
// month would land the calendar on the older month the archive ended up at.
// Each side skips a month the other already shows, so neither echoes back.
const calPage = ref<{ month: number; year: number } | null>(null)
let archiveScrolledByUser = false

function sameMonth(dateStr: string, page: { month: number; year: number } | null) {
  if (!dateStr || !page) return false
  const [y, m] = dateStr.split('-').map(Number)
  return y === page.year && m === page.month
}

function onCalendarMove(pages: { month: number; year: number }[]) {
  const page = pages[0]
  if (!page) return
  calPage.value = { month: page.month, year: page.year }
  if (viewMode.value !== 'archive' || sameMonth(archiveTopDate.value, page)) return
  scrollArchiveTo(localDateStr(new Date(page.year, page.month, 0)), true)
}

function followArchiveWithCalendar() {
  if (!archiveScrolledByUser || viewMode.value !== 'archive' || !archiveTopDate.value) return
  if (sameMonth(archiveTopDate.value, calPage.value)) return
  calendarRef.value?.move(new Date(archiveTopDate.value + 'T12:00:00'))
}

// Scrolling the archive by hand lets the calendar page along (see above).
function onArchiveScrolledByUser() {
  archiveScrolledByUser = true
}

// The archive's box is kept full: if the loaded entries don't reach its
// bottom and there are older ones, the next windows load straight in — no
// load pause, no domino, it's how the archive stands, not a load — until the
// box is full or nothing older is left. On opening, and whenever the box
// grows (tablet/phone: the calendar folds to its square right after
// opening, so the box only gets its real height then; also rotating /
// resizing). Measured on layout heights (the archive fades in with a
// transform), the endless-load run-out (.archive-more) not counted. The
// sentinel's own loading is held off meanwhile.
let archiveFilling = false
async function fillArchiveOnOpen() {
  if (archiveFilling) return
  archiveFilling = true
  archiveLoading.value = true
  try {
    for (let i = 0; i < 100; i++) {
      await nextTick()
      const root = dayDetailScrollRef.value
      const content = root?.querySelector<HTMLElement>('.day-detail-content')
      const next = nextOlderArchiveGroup.value
      if (!root || !content || !next) return
      const runOut = content.querySelector<HTMLElement>('.archive-more')?.offsetHeight ?? 0
      const cs = getComputedStyle(root)
      const room = root.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      if (content.offsetHeight - runOut >= room) return
      archiveWindows.value = archiveWindowsReaching(next.dateStr)
    }
  } finally {
    archiveLoading.value = false
    archiveFilling = false
  }
}

let archiveBoxObserver: ResizeObserver | null = null
watch(dayDetailScrollRef, (el) => {
  archiveBoxObserver?.disconnect()
  if (!el) return
  archiveBoxObserver = new ResizeObserver(() => fillArchiveOnOpen())
  archiveBoxObserver.observe(el)
})
onBeforeUnmount(() => archiveBoxObserver?.disconnect())

// Also when the calendar opens straight into the archive (the mode is kept).
onMounted(() => { if (viewMode.value === 'archive') fillArchiveOnOpen() })

// The archive opens at its top — today (see the viewMode watcher above).
function onArchiveShown() {
  updateArchiveMonth()
}

// Domino order for a new group's label and entries: one running index
// across everything that came in with the load, so the rows tip in one
// after another top to bottom. Capped so a big load doesn't keep the last
// rows waiting for seconds.
const ARCHIVE_DOMINO_CAP = 14
const archiveDominoStart = computed(() => {
  const start = new Map<string, number>()
  let i = 0
  for (const g of visibleArchiveGroups.value) {
    if (!newArchiveDates.value.has(g.dateStr)) continue
    start.set(g.dateStr, i)
    i += g.todos.length + 1
  }
  return start
})
function archiveDomino(dateStr: string, k: number) {
  const start = archiveDominoStart.value.get(dateStr)
  return start === undefined ? undefined : { '--i': Math.min(start + k, ARCHIVE_DOMINO_CAP) }
}

// Endless archive: the list ends in a bit of empty run-out (.archive-more) you can
// scroll on into, past the last entry. Its far end carries an invisible
// marker — once that's in view, the archive holds for a beat (so it reads as
// "reached the end, fetching more" rather than an unexplained stop) and
// then the next part dominoes in. Watched against the viewport (root
// null) rather than the scroll container, so it works whichever element
// actually scrolls on the current layout. Re-observed after every load:
// an observer only reports changes, so a marker that's still in view (a
// short archive that doesn't fill the screen yet) would otherwise never fire
// again.
const ARCHIVE_LOAD_PAUSE_MS = 350
const archiveSentinelRef = ref<HTMLElement | null>(null)
const archiveLoading = ref(false)
let archiveLoadTimer: ReturnType<typeof setTimeout> | null = null
const archiveObserver = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver(entries => {
      if (archiveLoading.value || !entries.some(e => e.isIntersecting)) return
      archiveLoading.value = true
      archiveLoadTimer = setTimeout(() => {
        archiveLoading.value = false
        showOlderLog()
      }, ARCHIVE_LOAD_PAUSE_MS)
    })
  : null
watch([archiveSentinelRef, () => visibleArchiveGroups.value.length], async ([el]) => {
  archiveObserver?.disconnect()
  if (!el) return
  await nextTick()
  archiveObserver?.observe(el)
})
// Content changes (switching to the archive, a load) move what's on top too.
watch([viewMode, () => visibleArchiveGroups.value.length], async () => {
  await nextTick()
  // The archive fades in (unfold transition) — wait for its groups to exist.
  requestAnimationFrame(updateArchiveMonth)
}, { immediate: true })

onBeforeUnmount(() => {
  archiveObserver?.disconnect()
  if (archiveLoadTimer) clearTimeout(archiveLoadTimer)
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

// TRIAL: each todo title in its own todo font, the same as on its card.
function todoFont(id: string) {
  return { fontFamily: todoFontFamily(id) }
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
         the calendar pinned, the boxes scrolling under it. In archive mode the
         calendar stays, the archive takes the place of the other boxes. The
         placement per layout lives in the CSS (grid areas). Notes go under
         the calendar, on the phone last in the scrolling stack. -->
    <motion.div
      class="calendar-board"
      :class="{
        'calendar-board--archive': viewMode === 'archive',
        'calendar-board--cal-closed': viewMode === 'archive' && !archiveCalOpen,
      }"
      :initial="{ opacity: 0, scale: 0.96 }"
      :animate="{ opacity: 1, scale: 1 }"
      :transition="{ type: 'spring', stiffness: 380, damping: 26, mass: 0.8 }"
    >
      <div
        class="board-col board-col--cal"
        :class="foldClass"
        :style="foldStyle"
      >
        <section ref="calBoxRef" class="board-box board-box--cal">
          <button v-if="foldable" type="button" class="cal-toggle" aria-label="show calendar" :tabindex="folded ? 0 : -1" @click="onFoldToggle">
            <CalendarIcon :size="20" />
          </button>
          <div ref="calInnerRef" class="cal-collapse-inner">
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
            <p v-if="viewMode === 'journal' && !isPhoneWidth" class="day-label">{{ selectedDateLabel }}</p>
            <button v-if="viewMode === 'archive'" type="button" class="icon-circle-btn cal-fold-btn" v-tooltip="'hide calendar'" @click="archiveCalOpen = false">
              <ChevronUp :size="12" />
            </button>
          </div>
        </section>
        <ScrollDivider v-if="foldable && viewMode === 'journal'" class="fold-head-divider" :visible="folded && boardScrolled" />
        <DayNotes v-if="viewMode === 'journal' && !isPhoneWidth" :date-str="selectedDate" @leave="viewRef?.focus()" />
      </div>

      <div v-if="viewMode === 'journal'" ref="boardRestRef" class="board-rest" :class="foldClass" :style="foldStyle">
        <!-- The spans are the fold's spacers (see .day-label-spacer). -->
        <p v-if="isPhoneWidth" class="day-label"><span class="day-label-spacer" />{{ selectedDateLabel }}<span class="day-label-spacer day-label-spacer--end" /></p>
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

      <div v-else class="board-archive">
        <!-- The archive's month marker: desktop right above the box, tablet/
             phone next to the folded calendar (see the CSS at the end). -->
        <div class="archive-month-row">
          <Transition name="archive-month" mode="out-in">
            <span v-if="showArchiveMonth" :key="archiveMonth" class="archive-month">{{ archiveMonth }}</span>
          </Transition>
        </div>

        <div ref="dayDetailScrollRef" class="board-box day-detail-scroll" @scroll="onDayDetailScroll" @wheel.passive="onArchiveScrolledByUser" @touchmove.passive="onArchiveScrolledByUser">
          <div ref="dayDetailRef" class="day-detail">
            <transition
              name="unfold"
              @after-enter="onArchiveShown"
              appear
              appear-active-class="unfold-appear-active"
              appear-from-class="unfold-appear-from"
            >
              <div class="day-detail-content">
                <template v-if="archiveGroups.length">
                  <p v-if="!visibleArchiveGroups.length" class="no-activity">Nothing completed in the last {{ ARCHIVE_WINDOW_DAYS }} days.</p>
                  <div v-for="group in visibleArchiveGroups" :key="group.dateStr" :data-date="group.dateStr" class="archive-group" :class="{ 'archive-group--new': newArchiveDates.has(group.dateStr) }">
                    <p class="board-box-label" :style="archiveDomino(group.dateStr, 0)">{{ group.label }}</p>
                    <div class="day-items">
                      <div v-for="(todo, i) in group.todos" :key="todo.id" class="day-item" :style="archiveDomino(group.dateStr, i + 1)">
                        <span class="icon"><CircleCheckIcon double :filled="todo.tags.includes(PRIORITY_TAG_ID)" size="1em" /></span>
                        <span class="day-item-title" :style="todoFont(todo.id)">{{ todo.title }}</span>
                        <span class="day-undo-slot"><UndoDoneButton :todo-id="todo.id" /></span>
                      </div>
                    </div>
                  </div>
                  <div v-if="nextOlderArchiveGroup" class="archive-more" aria-hidden="true">
                    <div ref="archiveSentinelRef" class="archive-sentinel" />
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
   future day's plan moves into done's place). The archive spans both
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

.calendar-board--archive {
  grid-template-areas: "cal archive archive";
}

.board-col--cal { grid-area: cal; }
.board-rest { grid-area: rest; }
.board-archive { grid-area: archive; }

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
   box: folded shut (tablet/phone archive), nothing of it may stay behind. */
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

/* A box's title (done / checks / planned …) and the archive's day labels.
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

/* A box head: label left, an icon on the right — checks' done ↔ open
   switch (a two-arrow "other side" icon that turns half a round per
   flip) and the notes' done tick while typing. :deep for DayNotes.vue.
   The switch sits in the label's own paleness; off ("done") it's paler
   again on top of that, on ("open", label then reads "open checks") it
   reads like the label itself. */
.calendar-view :deep(.board-box-head) {
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

/* ── The calendar fold (see --fold in the script) ──
   Tablet/phone archive and phone journal mode: the calendar box folds into a
   small ink-filled square with the calendar icon in --bg. --fold 0 → 1:
   the height shrinks the whole way (content rolls up, clipped) while the
   calendar fades out over the first half; the width only narrows in the
   second half (--fold-w), once nothing's left to squeeze, and the ink
   fill and icon come in with it — by opacity, transparent → opaque,
   never by blending colors. Registered so it can animate. */
@property --fold {
  syntax: '<number>';
  inherits: true;
  initial-value: 0;
}

.cal-foldable {
  --cal-fold-size: 44px;
  --fold-w: clamp(0, calc((var(--fold) - 0.5) * 2), 1);
}

.cal-fold-anim {
  transition: --fold 0.3s ease;
}

.cal-foldable .board-box--cal {
  --fold-open-w: 100%;
  position: relative;
  overflow: hidden;
  max-width: 100%;
  width: calc(var(--fold-open-w) - (var(--fold-open-w) - var(--cal-fold-size)) * var(--fold-w));
  height: calc(var(--fold-open-h) - (var(--fold-open-h) - var(--cal-fold-size)) * var(--fold));
  /* Not a blend of two colors: the ink shadow stays, the square's
     priority-style shadow lies over it, transparent → opaque with the
     fold (same as the ink fill below). */
  box-shadow:
    var(--card-shadow-offset) var(--card-shadow-offset) 0 color-mix(in srgb, var(--priority-shadow) calc(var(--fold-w) * 100%), transparent),
    var(--card-shadow-offset) var(--card-shadow-offset) 0 var(--ink);
}

.cal-foldable .board-box--cal::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  background: var(--ink);
  opacity: var(--fold-w);
  pointer-events: none;
}

/* Keeps its natural height inside the shrinking box (that's what gets
   measured), clipped by it. */
.cal-collapse-inner {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.cal-foldable .cal-collapse-inner {
  opacity: clamp(0, calc(1 - var(--fold) * 2), 1);
}

.cal-folded .cal-collapse-inner {
  pointer-events: none;
}

.cal-toggle {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: none;
  border: none;
  color: var(--bg);
  cursor: pointer;
  opacity: var(--fold-w);
  pointer-events: none;
}

.cal-folded .cal-toggle {
  pointer-events: auto;
}

.cal-fold-btn {
  display: none;
  align-self: center;
}

/* Phone, journal mode: as the calendar folds, the day's stack slides up
   into the folded square's row (by the column's height plus the gap,
   over the second half, with the square's shrinking), and the day label
   heading it moves in beside the square and stays put there (sticky) —
   the rest of the day scrolls on under both. The label carries --bg so
   nothing shows through it; the square's column sits above the stack. */
.board-col--cal.cal-foldable {
  position: relative;
  z-index: 2;
}

.board-rest.cal-foldable {
  margin-top: calc(-1 * (var(--cal-fold-size) + var(--board-shadow-room) + var(--board-gap)) * var(--fold-w));
}

.board-rest.cal-foldable > .day-label {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  min-height: calc(var(--cal-fold-size) * var(--fold-w));
  padding-left: calc((var(--cal-fold-size) + var(--board-gap)) * var(--fold-w));
}

/* Centered at rest, flush right once folded, smoothly in between: the free
   space on the label's left keeps its share, the right one's runs out
   with the fold. */
.board-rest.cal-foldable > .day-label > .day-label-spacer {
  flex: 1 1 0;
}

.board-rest.cal-foldable > .day-label > .day-label-spacer--end {
  flex-grow: calc(1 - var(--fold-w));
}

/* The head's bottom line once the day scrolls under it — the app's usual
   scroll divider, at the label backdrop's bottom edge (below): the
   square's height plus the gap under the label. Hung off the calendar's
   column rather than the stack, which clips at its own edges — the column
   doesn't, so the line runs the whole viewport width (the column's
   padding box is centered in it). */
.fold-head-divider {
  position: absolute;
  top: calc(var(--cal-fold-size) + var(--board-gap));
  left: 50%;
  width: 100vw;
  margin-left: -50vw;
}

/* The label's backdrop: --bg out past every edge of the stack (its own
   padding, the boxes' shadow room — clipped by the stack itself), so
   nothing scrolling under it peeks out anywhere — and down through the
   gap under the label (empty at rest anyway), so content disappears a
   bit below the square, its shadow and the label, not right at their
   edge. */
.board-rest.cal-foldable > .day-label::before {
  content: '';
  position: absolute;
  inset: -40px -40px calc(-1 * var(--board-gap) * var(--fold-w));
  z-index: -1;
  background: var(--bg);
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

/* ── Archive ── one big box, centered at reading width, scrolling inside. */
/* The archive's place on the board, next to the calendar — its box scrolls
   on its own, left-aligned at a readable width. */
.board-archive {
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-right: var(--board-shadow-room);
}

/* Desktop: the archive box grows right up to where the space beside it
   mirrors the space left of the calendar (screen edge to the calendar,
   the side menu included). The board is shifted left by --calendar-shift
   (layout.css, #app.is-calendar .main-content), so that space is the side
   column minus twice the shift, measured from the board's edge — the
   shadow room included. Its month row goes with it (no 720px cap). */
@media (min-width: 1025px) {
  .board-archive {
    padding-right: calc(var(--side-col) - 2 * var(--calendar-shift));
  }

  .board-archive .day-detail-scroll,
  .board-archive .archive-month-row {
    max-width: none;
  }
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

.archive-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

/* Month + year of the archive's topmost group in view (see updateArchiveMonth),
   hanging up out of a zero-height row above the box, right-aligned with
   it. Phone: right end of the journal | archive row instead. */
.archive-month-row {
  position: relative;
  flex-shrink: 0;
  height: 0;
  width: 100%;
  max-width: 720px;
}

.archive-month-row .archive-month {
  position: absolute;
  bottom: 8px;
  line-height: 1;
  right: 0;
}

.archive-month {
  color: var(--ink);
  font-size: var(--date-label-font-size);
  line-height: 1.2;
  font-weight: var(--date-label-font-weight);
  font-family: var(--font-playful, sans-serif);
  white-space: nowrap;
}

.archive-month-enter-active,
.archive-month-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.archive-month-enter-from,
.archive-month-leave-to {
  opacity: 0;
}

.archive-month-enter-from {
  transform: translateY(4px);
}

.archive-month-leave-to {
  transform: translateY(-4px);
}

/* Run-out past the last entry (see archiveSentinelRef) — room to scroll on
   into before the next part loads, the marker at its far end. */
.archive-more {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 120px;
}

.archive-sentinel {
  height: 1px;
}

/* A loaded part tips in row by row (index from archiveDomino). */
.archive-group--new .board-box-label,
.archive-group--new .day-item {
  animation: archive-domino 0.34s var(--ease-pop) backwards;
  animation-delay: calc(var(--i, 0) * 45ms);
}

@keyframes archive-domino {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.96);
  }
}

.unfold-enter-active,
.unfold-leave-active { transition: opacity 0.09s; }
.unfold-enter-from,
.unfold-leave-to { opacity: 0; }

/* First mount only (switching into the archive) — timed to the board's own
   entrance spring. */
.unfold-appear-active { transition: opacity 0.32s var(--ease-pop), transform 0.32s var(--ease-pop); }
.unfold-appear-from { opacity: 0; transform: translateY(8px); }

/* journal | archive switch for phone — desktop shows it in App.vue's left
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
   other box stacked in one scrolling column next to it (the archive alike).
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

  .calendar-board--archive {
    grid-template-areas: "cal archive";
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

  .archive-month-row {
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
  .board-archive {
    flex: 1;
    padding-top: 2px;
  }
}

/* Tablet and phone, archive mode: the calendar box on top left, folded shut
   to a small ink-filled icon square unless archiveCalOpen, the archive's month
   marker top right next to it, the archive filling the rest (the fold itself:
   see "The calendar fold" further up). Open, the box grows to at most
   --cal-fold-max wide (a calendar stretched across a
   tablet looks off); the marker stays, its bottom level with the box's
   bottom edge (folded or open — it rides along as the box unfolds; phone:
   under the open box, see below). The
   board turns into a grid with .board-archive dissolved into it (display:
   contents), so its month row can sit up there without a second copy.
   After the phone block so it wins over its rules. */
@media (max-width: 1024px) {
  .calendar-board--archive {
    --cal-fold-max: 360px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: "top" "archive";
  }

  .calendar-board--archive .board-archive {
    display: contents;
  }

  .calendar-board--archive .board-col--cal {
    grid-area: top;
    z-index: 1;
    flex-shrink: 0;
    padding: 0 var(--board-shadow-room) 0 0;
    overflow: visible;
  }

  .calendar-board--archive .board-box--cal {
    --fold-open-w: min(var(--cal-fold-max), 100%);
  }

  .calendar-board--archive .cal-fold-btn {
    display: flex;
  }

  .calendar-board--archive .archive-month-row {
    grid-area: top;
    align-self: end;
    display: flex;
    justify-content: flex-end;
    /* Desktop's row is 0 tall (the marker hangs above the archive box there);
       here it's the marker's own height, so its bottom is the box's. */
    height: auto;
    max-width: none;
    padding-right: var(--board-shadow-room);
  }

  .calendar-board--archive .archive-month-row .archive-month {
    position: static;
  }

  /* Full width — desktop's 720px cap would leave the month marker (full
     width up top) hanging past the box's right edge. */
  .calendar-board--archive .day-detail-scroll {
    grid-area: archive;
    width: auto;
    max-width: none;
    margin-right: var(--board-shadow-room);
  }
}
/* Phone: an unfolded calendar takes the whole width — the month marker
   moves to its own row under it instead of next to it. */
@media (max-width: 700px) {
  .calendar-board--archive:not(.calendar-board--cal-closed) {
    grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas: "top" "month" "archive";
  }

  .calendar-board--archive:not(.calendar-board--cal-closed) .archive-month-row {
    grid-area: month;
  }
}
</style>

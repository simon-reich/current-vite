import { computed } from 'vue'
import { useTodosStore } from '../stores/todos'
import { useChecksStore } from '../stores/checks'
import { addDaysStr, WEEKDAY_FULL_LABELS, MONTH_LABELS } from './useToday'

// Shared by every Date-List nav rendering (Overview's aside on desktop,
// Current's aside on desktop, and the tablet slide-in panel) — the actual
// "which dates are offered, dimmed or formatted how" logic lives here once
// instead of being copied per caller (see CLAUDE.md's single-source-of-
// truth principle). Callers own their own markup/click-handlers (Overview
// sets themeStore.selectedFocusDate, Current sets its local viewingDate),
// just not this date math.
export function useFocusDateNav() {
  const store = useTodosStore()
  const checksStore = useChecksStore()

  // Reactive "today" anchor instead of calling todayStr()/new Date()
  // straight inside a computed below: a plain Date read isn't a reactive
  // dependency, so a computed built on it has nothing to invalidate it at
  // midnight — it just freezes at whatever it first evaluated to (on
  // mount) for the rest of the tab's lifetime. checksStore.today already
  // gets refreshed at the app's three canonical points (mount, midnight,
  // tab refocus; see stores/checks.ts) for exactly this reason, so this
  // reuses that single source of truth instead of adding a second one.
  const today = computed(() => checksStore.today)
  const tomorrow = computed(() => addDaysStr(today.value, 1))

  const hasTodayList = computed(() => store.hasFocusDateList(today.value))
  const hasTomorrowList = computed(() => store.hasFocusDateList(tomorrow.value))

  // The next 7 days (today included) — always offered as selectable slots,
  // dimmed (never disabled) when nothing's on them yet. A rolling window,
  // not "this calendar week": always exactly 7 entries regardless of which
  // weekday today is. Anything beyond this window falls back to the old
  // membership-only behaviour (see upcomingFocusDates below) — no presets
  // past a week out.
  const presetWeekDates = computed(() => {
    const dates: string[] = []
    for (let i = 0; i < 7; i++) dates.push(addDaysStr(today.value, i))
    return dates
  })

  // Further-out lists beyond the preset week above — still purely
  // membership-driven (a date only shows up once something's actually on
  // it), since presetting weeks/months ahead would just be visual noise.
  const upcomingFocusDates = computed(() => {
    const windowEnd = presetWeekDates.value[presetWeekDates.value.length - 1]
    return store.futureFocusDates.filter(d => d > windowEnd)
  })

  // Interlude headings for the upcoming lists below the preset week: the
  // current calendar month's remainder groups under "month", everything
  // past that under its own month name — chronological, so a simple
  // consecutive-run grouping is enough (dates are already sorted). Kept
  // here rather than per-caller so Overview, Current and the tablet panel
  // (which all render this nav) stay in sync (see CLAUDE.md's single-
  // source-of-truth principle).
  // `sectionBreak` marks the one real break in the nav: today/tomorrow,
  // week and the current month's "month" group form one near-term block,
  // the first group past the current month starts the further-out lists.
  const upcomingFocusDateGroups = computed(() => {
    const [currentYear, currentMonth] = today.value.split('-').map(Number)
    const groups: { label: string; dates: string[]; sectionBreak: boolean }[] = []
    for (const dateStr of upcomingFocusDates.value) {
      const [y, m] = dateStr.split('-').map(Number)
      const isCurrentMonth = y === currentYear && m === currentMonth
      const label = isCurrentMonth ? 'month' : MONTH_LABELS[m - 1]
      const last = groups[groups.length - 1]
      if (last && last.label === label) last.dates.push(dateStr)
      else groups.push({ label, dates: [dateStr], sectionBreak: !isCurrentMonth && !groups.some(g => g.sectionBreak) })
    }
    return groups
  })

  // "07|07 tuesday" — day|month first (day-before-month, not the US
  // month-before-day order), then the spelled-out lowercase weekday, no
  // year (Date Lists only ever cover the near future in practice, see
  // rolloverExpiredFocusDates clearing out stale ones).
  // `weekdayFirst` ("tuesday 23|09") is for right-aligned lists (tablet's
  // side panel): the fixed-width date then lines up on the right edge
  // instead of the ragged weekday names.
  function formatUpcomingDate(dateStr: string, weekdayFirst = false): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    const weekday = WEEKDAY_FULL_LABELS[new Date(y, m - 1, d).getDay()]
    const date = `${String(d).padStart(2, '0')}|${String(m).padStart(2, '0')}`
    return weekdayFirst ? `${weekday} ${date}` : `${date} ${weekday}`
  }

  // Same as formatUpcomingDate, but special-cases today/tomorrow the same
  // way the dedicated buttons already read — used for the preset week's
  // day-3..7 slots, which don't get their own hardcoded button.
  function formatPresetDate(dateStr: string, weekdayFirst = false): string {
    if (dateStr === today.value) return 'today'
    if (dateStr === tomorrow.value) return 'tomorrow'
    return formatUpcomingDate(dateStr, weekdayFirst)
  }

  return { hasTodayList, hasTomorrowList, presetWeekDates, upcomingFocusDates, upcomingFocusDateGroups, formatUpcomingDate, formatPresetDate }
}

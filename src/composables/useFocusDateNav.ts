import { computed } from 'vue'
import { useTodosStore } from '../stores/todos'
import { todayStr, tomorrowStr, localDateStr, WEEKDAY_LABELS } from './useToday'

// Shared by every Date-List nav rendering (Overview's aside on desktop,
// Current's aside on desktop, and the tablet slide-in panel) — the actual
// "which dates are offered, dimmed or formatted how" logic lives here once
// instead of being copied per caller (see CLAUDE.md's single-source-of-
// truth principle). Callers own their own markup/click-handlers (Overview
// sets themeStore.selectedFocusDate, Current sets its local viewingDate),
// just not this date math.
export function useFocusDateNav() {
  const store = useTodosStore()

  const hasTodayList = computed(() => store.hasFocusDateList(todayStr()))
  const hasTomorrowList = computed(() => store.hasFocusDateList(tomorrowStr()))

  // The next 7 days (today included) — always offered as selectable slots,
  // dimmed (never disabled) when nothing's on them yet. A rolling window,
  // not "this calendar week": always exactly 7 entries regardless of which
  // weekday today is. Anything beyond this window falls back to the old
  // membership-only behaviour (see upcomingFocusDates below) — no presets
  // past a week out.
  const presetWeekDates = computed(() => {
    const dates: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      dates.push(localDateStr(d))
    }
    return dates
  })

  // Further-out lists beyond the preset week above — still purely
  // membership-driven (a date only shows up once something's actually on
  // it), since presetting weeks/months ahead would just be visual noise.
  const upcomingFocusDates = computed(() => {
    const windowEnd = presetWeekDates.value[presetWeekDates.value.length - 1]
    return store.futureFocusDates.filter(d => d > windowEnd)
  })

  // "TUE, 07.07" — uppercase weekday first, then day.month (day-before-
  // month, not the US month-before-day order), no year (Date Lists only
  // ever cover the near future in practice, see rolloverExpiredFocusDates
  // clearing out stale ones).
  function formatUpcomingDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    const weekday = WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()]
    return `${weekday}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}`
  }

  // Same as formatUpcomingDate, but special-cases today/tomorrow the same
  // way the dedicated buttons already read — used for the preset week's
  // day-3..7 slots, which don't get their own hardcoded button.
  function formatPresetDate(dateStr: string): string {
    if (dateStr === todayStr()) return 'today'
    if (dateStr === tomorrowStr()) return 'tomorrow'
    return formatUpcomingDate(dateStr)
  }

  return { hasTodayList, hasTomorrowList, presetWeekDates, upcomingFocusDates, formatUpcomingDate, formatPresetDate }
}

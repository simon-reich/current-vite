import type { LoopInterval, Todo } from '../stores/todos'
import { LOOP_TAG_ID } from '../stores/todos'
import { todayStr, addDaysStr, localDayOf, appDate, DAY_START_HOUR } from './useToday'

function parseISODate(s: string): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function localMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000)
}

// Whether `today` is a due day. In 'once' mode that's simply "on or after
// the chosen date" — no recurrence math, and it stays due (keeps
// resurfacing) until actually completed, same as an unfinished loop todo
// would. In 'loop' mode (or legacy data predating the `mode` field, which
// always had unit+count set), counts from startDate in steps of count
// units. Month/year matching clamps to the last day of a shorter month
// (e.g. a 31st-of-the-month loop lands on the 28th/29th/30th in months
// that don't have a 31st).
export function isLoopDueToday(interval: LoopInterval, today: Date = appDate(), fallbackStart?: string): boolean {
  // Pre-dates the startDate field (loopInterval existed before it was
  // added) — fall back to whatever the caller supplies (createdAt, see
  // runLoopSchedule) instead of leaving it permanently un-due.
  const start = parseISODate(interval.startDate) ?? (fallbackStart ? parseISODate(fallbackStart) : null)
  if (!start) return false
  const t = localMidnight(today)
  if (t < start) return false

  if ((interval.mode ?? 'loop') === 'once') return true

  const count = Math.max(1, interval.count ?? 1)

  if (interval.unit === 'day') {
    return daysBetween(t, start) % count === 0
  }
  if (interval.unit === 'week') {
    return daysBetween(t, start) % (7 * count) === 0
  }
  if (interval.unit === 'month') {
    const diffMonths = (t.getFullYear() - start.getFullYear()) * 12 + (t.getMonth() - start.getMonth())
    if (diffMonths < 0 || diffMonths % count !== 0) return false
    const daysInTargetMonth = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
    return t.getDate() === Math.min(start.getDate(), daysInTargetMonth)
  }
  if (interval.unit === 'weekdays') {
    return (interval.weekdays ?? []).includes(t.getDay())
  }
  // 'year'
  const diffYears = t.getFullYear() - start.getFullYear()
  if (diffYears < 0 || diffYears % count !== 0) return false
  const daysInTargetMonth = new Date(t.getFullYear(), start.getMonth() + 1, 0).getDate()
  return t.getMonth() === start.getMonth() && t.getDate() === Math.min(start.getDate(), daysInTargetMonth)
}

// Clamped month/year add matching isLoopDueToday's own date construction
// (see comment there) — a 31st-of-the-month loop lands on the last day of
// shorter months instead of overflowing into the next one.
function addClampedMonths(start: Date, months: number): Date {
  const target = new Date(start.getFullYear(), start.getMonth() + months, 1)
  const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return new Date(target.getFullYear(), target.getMonth(), Math.min(start.getDate(), daysInTargetMonth))
}

// The next date (today included) on which `interval` is due — analytical,
// not a brute-force day-by-day scan, so an "every 999 days"/"every 999
// years" loop resolves instantly instead of iterating hundreds of times.
// This is what LoopPicker shows so a loop whose startDate lies far in the
// past (an old daily/weekly grid, a long custom interval) stays legible —
// otherwise the "next" run is easy to lose track of. Returns null only for
// malformed/missing data (no startDate to count from).
export function nextLoopOccurrence(interval: LoopInterval, today: Date = appDate()): Date | null {
  const start = parseISODate(interval.startDate)
  if (!start) return null
  const t = localMidnight(today)

  if ((interval.mode ?? 'loop') === 'once') return start

  const count = Math.max(1, interval.count ?? 1)

  // weekdays is checked before the "start not reached yet" shortcut below
  // — unlike every other unit, the start date itself isn't necessarily a
  // due day (it's just an anchor/"count from here" point, same as the
  // others), so the shortcut's "start is always the first occurrence"
  // assumption doesn't hold here. Searches forward from whichever of
  // start/today is later.
  if (interval.unit === 'weekdays') {
    const days = interval.weekdays ?? []
    if (!days.length) return null
    const from = t < start ? start : t
    for (let i = 0; i < 7; i++) {
      const candidate = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
      if (days.includes(candidate.getDay())) return candidate
    }
    return null
  }

  if (t <= start) return start

  if (interval.unit === 'day') {
    const diff = daysBetween(t, start)
    const rem = diff % count
    return rem === 0 ? t : new Date(t.getFullYear(), t.getMonth(), t.getDate() + (count - rem))
  }
  if (interval.unit === 'week') {
    const step = 7 * count
    const diff = daysBetween(t, start)
    const rem = diff % step
    return rem === 0 ? t : new Date(t.getFullYear(), t.getMonth(), t.getDate() + (step - rem))
  }
  if (interval.unit === 'month') {
    const diffMonths = (t.getFullYear() - start.getFullYear()) * 12 + (t.getMonth() - start.getMonth())
    const rem = diffMonths % count
    let candidateMonths = rem === 0 ? diffMonths : diffMonths + (count - rem)
    let candidate = addClampedMonths(start, candidateMonths)
    while (candidate < t) {
      candidateMonths += count
      candidate = addClampedMonths(start, candidateMonths)
    }
    return candidate
  }
  // 'year'
  const diffYears = t.getFullYear() - start.getFullYear()
  const rem = diffYears % count
  let candidateYears = rem === 0 ? diffYears : diffYears + (count - rem)
  let candidate = addClampedMonths(start, candidateYears * 12)
  while (candidate < t) {
    candidateYears += count
    candidate = addClampedMonths(start, candidateYears * 12)
  }
  return candidate
}

// Already handled today — sent to Current today (manual or automatic,
// whether that stuck or it's inCurrent:false again by now) or checked off
// via "Done for now" today. Either one keeps this loop todo out of Current
// for the rest of today, not just until the next scheduled check (tab
// refocus, see App.vue) re-adds it. Compared by local day (localDayOf) —
// a UTC day read right after local midnight (exactly when the midnight
// check sends due todos) let a todo already done for now today get sent
// right back on the next refocus.
function processedToday(todo: Todo): boolean {
  const today = todayStr()
  const isToday = (ts: string) => localDayOf(ts) === today
  return (!!todo.focusAddedAt && isToday(todo.focusAddedAt)) || todo.workLog.some(isToday)
}

// Today's occurrence is settled — handled today (see processedToday) and
// no longer pending on Current, so it won't come back before the next
// interval date. That's when the next due date counts from tomorrow
// instead of today (see nextLoopDue).
export function isLoopSettledToday(todo: Todo): boolean {
  return !todo.inCurrent && processedToday(todo)
}

// nextLoopOccurrence, but skipping today once today's occurrence is
// already settled — "today" would be true by the schedule, but it's
// already done, so the next real run is the following interval date.
// Shared by LoopPicker's "next" line (todos and Checks) and Overview's
// Date-filter "only" sort.
export function nextLoopDue(interval: LoopInterval, settledToday = false): Date | null {
  const from = appDate()
  if (settledToday) from.setDate(from.getDate() + 1)
  return nextLoopOccurrence(interval, from)
}

export interface LoopScheduleStore {
  todos: Todo[]
  loopScheduleRanOn: string | undefined
  sendToCurrent: (id: string) => void
  hasFocusDateList: (dateStr: string) => boolean
  assignFocusDate: (id: string, dateStr: string) => void
}

// Catch-up: an occurrence due on a day the app was never opened (no run
// at all between store.loopScheduleRanOn and today) would otherwise never
// have become pending — it counts as missed and joins today the same way,
// one pending occurrence no matter how many were missed. Has to run before
// rolloverExpiredFocusDates on a new day (see App.vue), which trims the
// past exclusions missedSinceLastRun respects.
const MAX_CATCH_UP_DAYS = 366

function missedSinceLastRun(todo: Todo, ranOn: string | undefined, today: string): boolean {
  const interval = todo.loopInterval!
  if (!ranOn || todo.inCurrent || (interval.mode ?? 'loop') === 'once') return false
  const created = localDayOf(todo.createdAt)
  let day = addDaysStr(ranOn, 1)
  const earliest = addDaysStr(today, -MAX_CATCH_UP_DAYS)
  if (day < earliest) day = earliest
  for (; day < today; day = addDaysStr(day, 1)) {
    if (day < created || todo.excludedFocusDates?.includes(day)) continue
    if (isLoopDueToday(interval, new Date(`${day}T12:00:00`), created)) return true
  }
  return false
}

// Sends every due, not-yet-completed loop todo to Current — called once on
// load and again every midnight while the app stays open (see
// scheduleLoopMidnightCheck below). Current and today's Date List are
// independent lists (see stores/todos.ts's Date Lists section), so a due
// todo always joins `inCurrent` and — separately, only if today already has
// its own Date List — also gets today's focusDate, landing in both at once.
// It never creates a Date List for today out of thin air — see App.vue's
// addTodo for the same rule applied to a todo typed in directly.
// Also catches up on missed occurrences, see missedSinceLastRun.
export function runLoopSchedule(store: LoopScheduleStore) {
  const today = todayStr()
  const ranOn = store.loopScheduleRanOn
  const hasDateListToday = store.hasFocusDateList(today)
  for (const todo of store.todos) {
    if (!todo.loopInterval || !todo.tags.includes(LOOP_TAG_ID) || todo.completedAt || todo.deletedAt) continue
    if (processedToday(todo)) continue
    // One malformed todo (unexpected data shape) should never stop the
    // rest of the list from being checked, or bubble up into App.vue's
    // onMounted and cut off whatever runs after it there.
    try {
      if (isLoopDueToday(todo.loopInterval, appDate(), localDayOf(todo.createdAt)) || missedSinceLastRun(todo, ranOn, today)) {
        // Sets focusAddedAt, which also satisfies processedToday's "already
        // handled today" guard for the assignFocusDate branch below.
        store.sendToCurrent(todo.id)
        if (hasDateListToday) store.assignFocusDate(todo.id, today)
      }
    } catch (err) {
      console.error('[loop schedule] skipping todo', todo.id, err)
    }
  }
  store.loopScheduleRanOn = today
}

// Schedules runLoopSchedule to fire right after the next local midnight,
// then reschedules itself for the one after that — covers a tab left
// open for days without a reload, not just the on-load check. `onMidnight`
// is an optional extra callback for anything else that's also "once a
// day" (currently just the theme store's runDailyThemeRotation) — reuses
// this same timer instead of running a second, near-identical
// wait-for-midnight chain alongside it.
export function scheduleLoopMidnightCheck(store: LoopScheduleStore, onMidnight?: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  function scheduleNext() {
    // The app's day boundary is DAY_START_HOUR, not midnight (see
    // useToday.ts) — a few seconds past it, today's if still ahead,
    // tomorrow's otherwise.
    const now = new Date()
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), DAY_START_HOUR, 0, 5)
    if (next <= now) next.setDate(next.getDate() + 1)
    timer = setTimeout(() => {
      runLoopSchedule(store)
      onMidnight?.()
      scheduleNext()
    }, next.getTime() - now.getTime())
  }

  scheduleNext()
  return () => { if (timer) clearTimeout(timer) }
}

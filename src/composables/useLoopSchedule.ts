import type { LoopInterval, Todo } from '../stores/todos'
import { LOOP_TAG_ID } from '../stores/todos'
import { todayStr } from './useToday'

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
export function isLoopDueToday(interval: LoopInterval, today: Date = new Date(), fallbackStart?: string): boolean {
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
export function nextLoopOccurrence(interval: LoopInterval, today: Date = new Date()): Date | null {
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

// Already handled today (sent to Current today, whether that stuck — via
// "Done for today" it can be inCurrent:false again by now — or not) — set
// on every sendToCurrent(), manual or automatic. Reusing it instead of a
// dedicated field means "Done for today" earlier today correctly keeps
// this loop todo out of Current for the rest of today, not just until the
// next scheduled check re-adds it.
function processedToday(todo: Todo): boolean {
  return !!todo.focusAddedAt && todo.focusAddedAt.slice(0, 10) === todayStr()
}

export interface LoopScheduleStore {
  todos: Todo[]
  sendToCurrent: (id: string) => void
  hasFocusDateList: (dateStr: string) => boolean
  assignFocusDate: (id: string, dateStr: string) => void
}

// Sends every due, not-yet-completed loop todo to Current — called once on
// load and again every midnight while the app stays open (see
// scheduleLoopMidnightCheck below). Current and today's Date List are
// independent lists (see stores/todos.ts's Date Lists section), so a due
// todo always joins `inCurrent` and — separately, only if today already has
// its own Date List — also gets today's focusDate, landing in both at once.
// It never creates a Date List for today out of thin air — see App.vue's
// addTodo for the same rule applied to a todo typed in directly.
export function runLoopSchedule(store: LoopScheduleStore) {
  const today = todayStr()
  const hasDateListToday = store.hasFocusDateList(today)
  for (const todo of store.todos) {
    if (!todo.loopInterval || !todo.tags.includes(LOOP_TAG_ID) || todo.completedAt || todo.deletedAt) continue
    if (processedToday(todo)) continue
    // One malformed todo (unexpected data shape) should never stop the
    // rest of the list from being checked, or bubble up into App.vue's
    // onMounted and cut off whatever runs after it there.
    try {
      if (isLoopDueToday(todo.loopInterval, new Date(), todo.createdAt.slice(0, 10))) {
        // Sets focusAddedAt, which also satisfies processedToday's "already
        // handled today" guard for the assignFocusDate branch below.
        store.sendToCurrent(todo.id)
        if (hasDateListToday) store.assignFocusDate(todo.id, today)
      }
    } catch (err) {
      console.error('[loop schedule] skipping todo', todo.id, err)
    }
  }
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
    const now = new Date()
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
    timer = setTimeout(() => {
      runLoopSchedule(store)
      onMidnight?.()
      scheduleNext()
    }, nextMidnight.getTime() - now.getTime())
  }

  scheduleNext()
  return () => { if (timer) clearTimeout(timer) }
}

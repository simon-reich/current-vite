// Local calendar date, not UTC — every "today"/"tomorrow" string in this
// app has to speak the same calendar day the user is actually looking at.
// `toISOString().slice(0, 10)` (the bug this replaces) reads the UTC date
// instead: for a positive-offset timezone that's wrong for a window right
// after local midnight, for a negative-offset one (e.g. US zones) it can be
// wrong most of the evening. The date picker (v-calendar) already builds
// `focusDates` from local year/month/day, so anything comparing against it
// has to match — see CLAUDE.md's Date Lists section.
export function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// The app's day doesn't flip at midnight but at DAY_START_HOUR (3am local)
// — working on past midnight still counts as the evening's day: today's
// list, Current's yesterday leftovers, loop due-ness, Checks and the
// calendar's day for a check-off all switch over at 3am instead. Every
// "which day is it / was it" question goes through appDate below, so this
// is the one place that shift lives.
export const DAY_START_HOUR = 3

// The moment shifted back by DAY_START_HOUR — its local calendar date is
// the app day that moment belongs to. Pass the wall clock (default) or a
// stored timestamp.
export function appDate(at: Date = new Date()): Date {
  const d = new Date(at)
  d.setHours(d.getHours() - DAY_START_HOUR)
  return d
}

// The app day (see DAY_START_HOUR) an ISO timestamp (completedAt, workLog,
// createdAt, focusAddedAt, ... — all stored as UTC via toISOString) falls
// on. Use this instead of `.slice(0, 10)`, which reads the UTC day (see
// localDateStr above for why that's wrong).
export function localDayOf(iso: string): string {
  return localDateStr(appDate(new Date(iso)))
}

// Last second of a local calendar day, as the ISO timestamp the stores
// keep — for backdating a check-off onto that day (see Current.vue's
// yesterday leftovers), so the calendar files it under exactly that day.
export function endOfDayIso(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59).toISOString()
}

export function todayStr(): string {
  return localDateStr(appDate())
}

export function tomorrowStr(): string {
  const d = appDate()
  d.setDate(d.getDate() + 1)
  return localDateStr(d)
}

// Offsets an already-known date string by N days — used wherever a date
// needs to be derived from a reactive "today" anchor (e.g. useFocusDateNav)
// instead of reading the wall clock again, which would re-introduce the
// same "no reactive dependency" staleness a plain todayStr()/tomorrowStr()
// call inside a computed has.
export function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return localDateStr(date)
}

// Sunday-first, matching Date#getDay()/v-calendar's own weekday numbering.
export const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

// Same order, spelled out and lowercase per the app's UI-chrome casing rule
// (see CLAUDE.md) — used for the Date-List nav's upcoming-date chips.
export const WEEKDAY_FULL_LABELS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// Lowercase per the app's UI-chrome casing rule (see CLAUDE.md) — used for
// the Date-List nav's interlude month headings.
export const MONTH_LABELS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

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

export function todayStr(): string {
  return localDateStr(new Date())
}

export function tomorrowStr(): string {
  const d = new Date()
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

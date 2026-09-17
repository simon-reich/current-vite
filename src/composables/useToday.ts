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

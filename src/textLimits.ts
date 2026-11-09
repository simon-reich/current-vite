// Every length cap on what you can type into the app, in one place.
// Generous on purpose — they're only there against runaways (a huge paste
// by accident): everything shares localStorage's ~5 MB, and once that's
// full saving fails, possibly for unrelated data too.
//
// Each cap is enforced twice, the same way everywhere:
// - the field's maxlength (typing/pasting stops there), and
// - the store, on every way in — add, edit and import (older or hand-edited
//   export files) — via clipLine/clipText below.
// The values are first guesses, to be watched in daily use.

// A todo or sub gets a few sentences (200/150 felt tight in use).
export const TODO_TITLE_MAX_LENGTH = 400
export const SUB_TITLE_MAX_LENGTH = 300
// A chip label — longer ones get cut off in the chips anyway.
export const TAG_LABEL_MAX_LENGTH = 30
// The tag fields take several at once ("a, b, c"): the cap above applies
// per tag (tagLabel), the field itself just gets a generous ceiling.
export const TAG_INPUT_MAX_LENGTH = 300
// Checks: short reminder phrases, not todo-length titles — Current stacks
// them one per line, each meant to stay a single readable line.
export const CHECK_TITLE_MAX_LENGTH = 50
// About two pages — plenty for a day's or a list's notes.
export const NOTE_MAX_LENGTH = 5000
export const THEME_NAME_MAX_LENGTH = 32

// A single-line text as it gets stored: no edge whitespace, capped.
export function clipLine(text: string, max: number): string {
  return text.trim().slice(0, max)
}

// A multi-line text (notes) or imported text: kept as written, capped.
export function clipText(text: string, max: number): string {
  return text.slice(0, max)
}

// A typed tag label as it gets stored — also what a new label is checked
// against existing ones with, so a cut-down long label still finds its
// earlier twin.
export function tagLabel(text: string): string {
  return clipLine(text, TAG_LABEL_MAX_LENGTH)
}

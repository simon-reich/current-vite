// Literary typography for free text (the notes, NotesBox.vue — applied
// once on leaving the field, never while typing, so undo keeps working):
// - straight double quotes → French guillemets, snug to the quoted text
//   («so», no spaces inside): opening at the start or after whitespace or
//   an opening bracket, closing everywhere else;
// - a hyphen standing alone mid-sentence ("word - word") → an em dash.
//   Not at a line's start (a list "- item", indented or not) and not right
//   after a sentence's end (". - "), where it would start a sentence.
export function literaryTypography(text: string): string {
  return text
    .replace(/(^|[\s([{])"/g, '$1«')
    .replace(/"/g, '»')
    .replace(/([^\s.!?]) -(?= )/g, '$1 —')
}

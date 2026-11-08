// Font families available for todo card titles.
// Order matters for the hash-based assignment — don't sort alphabetically.
export const TODO_FONTS = [
  'Aleo',
  'Bodoni Moda',
  'Cardo',
  'EB Garamond',
  'Faustina',
  'Karla',
  'Lora',
  'Manrope',
  'Merienda',
  'Merriweather',
  'Montserrat',
  'Patrick Hand',
  'Roboto',
  'Roboto Condensed',
  'Roboto Slab',
  'Sorts Mill Goudy',
  'Amarante',
]

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h * 31 + id.charCodeAt(i), 1) >>> 0
  }
  return h
}

/**
 * A todo's font-family — from its ID alone, so the same todo shows in the
 * same font everywhere (Overview, Current, Calendar) and never changes
 * with the list around it. There used to be a "no two neighbours share a
 * font" shift on top, but that made a todo's font depend on who stood
 * above it: re-sorting a list (e.g. Overview's selected Date List moving
 * to the front) or another view swapped fonts on unchanged todos. Two
 * neighbours sharing a font now and then is the price.
 */
export function todoFont(id: string): string {
  return TODO_FONTS[hashId(id) % TODO_FONTS.length]
}

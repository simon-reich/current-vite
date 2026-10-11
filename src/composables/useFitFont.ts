// Shrinks `el`'s font size in small steps until `fits()` holds — at most
// down to `minRatio` of its base size, which always comes from CSS (the
// inline size is cleared first) rather than a duplicated constant, so it
// keeps tracking the real breakpoint values. Re-measured at every step
// rather than computed once: text width doesn't scale perfectly linearly
// with font-size (glyph hinting/rounding), so a single computed guess can
// still be off by a character or two. If even the smallest allowed size
// doesn't fit, the element goes back to its CSS size and this returns false.
export function shrinkFontToFit(
  el: HTMLElement,
  fits: () => boolean,
  { minRatio = 0.85, step = 0.3 }: { minRatio?: number; step?: number } = {},
): boolean {
  el.style.fontSize = ''
  if (fits()) return true
  const baseSize = parseFloat(getComputedStyle(el).fontSize)
  const minSize = baseSize * minRatio
  for (let size = baseSize - step; size >= minSize; size -= step) {
    el.style.fontSize = `${size.toFixed(2)}px`
    if (fits()) return true
  }
  el.style.fontSize = ''
  return false
}

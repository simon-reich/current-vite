// A small "knall" right at a checkbox when it gets ticked — otherwise a
// completely flat, silent state flip, unlike completing a Todo (see
// TodoCard.vue's celebrateBackground). Deliberately tiny and anchored to
// the checkbox itself, not a full-viewport effect — used by both Checks
// (Current.vue) and Subs (TodoCard.vue), whose own checkbox-ticking is the
// same kind of lower-weight, background event. Both respect
// celebrationsEnabled (the same toggle the big Todo celebration does)
// rather than adding a second, near-identical setting.
export function burstCheckbox(el: HTMLElement) {
  el.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.5)', offset: 0.4 },
      { transform: 'scale(1)' },
    ],
    { duration: 260, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  )

  // A handful of tiny sparks radiating out from the checkbox's center — a
  // miniature version of the old bgFireworks particle burst (see the
  // commented-out particle effects in TodoCard.vue), scaled way down and
  // anchored to this one checkbox instead of the whole viewport.
  const rect = el.getBoundingClientRect()
  burstSparks(rect.left + rect.width / 2, rect.top + rect.height / 2)
}

// Just the sparks, at a viewport point — burstCheckbox's own, and reused
// on its own wherever something should pop without the checkbox's scale
// bump (e.g. a yesterday leftover popping away in Current.vue). count/
// reach scale it up for something bigger than a checkbox.
export function burstSparks(cx: number, cy: number, count = 6, reach = 14) {
  for (let i = 0; i < count; i++) {
    const angle = (360 / count) * i + (Math.random() - 0.5) * 20
    const dist = reach + Math.random() * (reach * 4 / 7)
    const dx = Math.cos((angle * Math.PI) / 180) * dist
    const dy = Math.sin((angle * Math.PI) / 180) * dist
    const spark = document.createElement('span')
    spark.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:4px;height:4px;background:var(--ink);border-radius:50%;pointer-events:none;user-select:none;transform:translate(-50%,-50%);z-index:9999;`
    document.body.appendChild(spark)
    spark.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.4)`, opacity: 0 },
      ],
      { duration: 320, easing: 'ease-out' },
    ).onfinish = () => spark.remove()
  }
}

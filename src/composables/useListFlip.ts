import { nextTick, watch } from 'vue'

// Vue's built-in <TransitionGroup> move animation turned out unreliable
// here — its FLIP trick (invert transform, force reflow, clear transform
// under a transitioning CSS class) never actually started a transition in
// this app (verified via document.getAnimations() staying empty), for
// reasons not worth chasing further. This does the same FLIP technique by
// hand with the Web Animations API instead, which the swipe/celebration
// effects elsewhere in the app already rely on directly and know works.
//
// Usage: call useListFlip(() => idsInRenderOrder, container) once per list
// view. Each item's root element must carry `data-flip-id="<id>"` (falls
// through automatically onto a child component's root via a `data-flip-id`
// prop/attr on the component tag). Whenever the id list changes, elements
// whose position actually moved animate from their old spot to the new one.
//
// `container` is either a CSS selector (page-level lists, unique in the
// document — AllTodos/Current's own todo list) or a getter returning an
// Element directly (per-instance lists that exist many times at once, e.g.
// TodoCard's own sub-row list — one per card, so a selector alone couldn't
// tell which instance to measure).
export function useListFlip(ids: () => string[], container: string | (() => Element | null)) {
  let oldRects: Map<string, DOMRect> | null = null

  function resolveContainer(): Element | null {
    return typeof container === 'string' ? document.querySelector(container) : container()
  }

  function capture() {
    const container = resolveContainer()
    if (!container) { oldRects = null; return }
    const map = new Map<string, DOMRect>()
    container.querySelectorAll<HTMLElement>('[data-flip-id]').forEach(el => {
      map.set(el.dataset.flipId!, el.getBoundingClientRect())
    })
    oldRects = map
  }

  async function play() {
    const captured = oldRects
    oldRects = null
    if (!captured) return
    await nextTick()
    const container = resolveContainer()
    if (!container) return
    container.querySelectorAll<HTMLElement>('[data-flip-id]').forEach(el => {
      const id = el.dataset.flipId!
      const oldRect = captured.get(id)
      if (!oldRect) return
      const newRect = el.getBoundingClientRect()
      const dx = oldRect.left - newRect.left
      const dy = oldRect.top - newRect.top
      if (!dx && !dy) return
      // Back-out (bounce) easing for the short reshuffles a delete/swipe
      // causes — its overshoot scales with distance moved, though, and a
      // sort can drag a card the full height of the list, turning that same
      // curve into a wild fling. Past OVERSHOOT_MAX_DISTANCE we fall back to
      // plain ease-out instead.
      const distance = Math.hypot(dx, dy)
      const OVERSHOOT_MAX_DISTANCE = 160
      const { duration, easing } = distance <= OVERSHOOT_MAX_DISTANCE
        ? { duration: 380, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
        : { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration, easing },
      )
    })
  }

  // flush: 'pre' runs before the DOM patch for this same reactive change,
  // so capture() still sees the old layout; play()'s nextTick then waits
  // for the patch to land before measuring/animating the new one.
  watch(ids, () => { capture(); play() }, { flush: 'pre' })
}

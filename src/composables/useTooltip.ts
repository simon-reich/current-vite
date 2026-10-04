import type { Directive } from 'vue'

// App-styled replacement for the native `title` tooltip — the browser draws
// that one itself (OS colors/font), so it can't follow the app's four-color
// rule. Usage: v-tooltip="'text'" (or any expression; falsy = no tooltip),
// wherever `title="..."` would otherwise go. One shared tooltip element for
// the whole app, styled in base.css (.app-tooltip). Hover-capable devices
// only — touch has no hover, the native title never showed there either.

const SHOW_DELAY_MS = 350
const GAP_PX = 6
const EDGE_PX = 8

type TooltipEl = HTMLElement & {
  _tooltipText?: string
  _tooltipOwnsAriaLabel?: boolean
  _tooltipEnter?: () => void
  _tooltipLeave?: () => void
}

let tip: HTMLDivElement | null = null
let activeEl: TooltipEl | null = null
let showTimer: ReturnType<typeof setTimeout> | null = null

const canHover = () => window.matchMedia('(hover: hover)').matches

function tipEl(): HTMLDivElement {
  if (!tip) {
    tip = document.createElement('div')
    tip.className = 'app-tooltip'
    tip.setAttribute('role', 'tooltip')
    document.body.appendChild(tip)
    // Scrolling moves the element out from under a fixed-position tip.
    window.addEventListener('scroll', hide, true)
  }
  return tip
}

// Centered below the element, flipped above if there's no room below,
// clamped horizontally so it never runs off either viewport edge.
function position(el: HTMLElement) {
  const t = tipEl()
  const r = el.getBoundingClientRect()
  const w = t.offsetWidth
  const h = t.offsetHeight
  const left = Math.min(Math.max(r.left + r.width / 2 - w / 2, EDGE_PX), window.innerWidth - w - EDGE_PX)
  const below = r.bottom + GAP_PX
  const top = below + h > window.innerHeight - EDGE_PX ? r.top - GAP_PX - h : below
  t.style.left = `${left}px`
  t.style.top = `${top}px`
}

function show(el: TooltipEl) {
  if (!el._tooltipText || !el.isConnected) return
  const t = tipEl()
  t.textContent = el._tooltipText
  position(el)
  t.classList.add('visible')
}

function hide() {
  if (showTimer) { clearTimeout(showTimer); showTimer = null }
  activeEl = null
  tip?.classList.remove('visible')
}

function setText(el: TooltipEl, value: unknown) {
  el._tooltipText = value ? String(value) : undefined
  // Icon-only buttons relied on `title` for their accessible name — give
  // them an aria-label instead, but never touch one the markup set itself.
  if (el.hasAttribute('aria-label') && !el._tooltipOwnsAriaLabel) return
  if (el._tooltipText && !el.textContent?.trim()) {
    el.setAttribute('aria-label', el._tooltipText)
    el._tooltipOwnsAriaLabel = true
  } else if (el._tooltipOwnsAriaLabel) {
    el.removeAttribute('aria-label')
    el._tooltipOwnsAriaLabel = false
  }
}

export const vTooltip: Directive<TooltipEl, unknown> = {
  mounted(el, binding) {
    setText(el, binding.value)
    el._tooltipEnter = () => {
      if (!canHover() || !el._tooltipText) return
      hide()
      activeEl = el
      showTimer = setTimeout(() => show(el), SHOW_DELAY_MS)
    }
    el._tooltipLeave = () => { if (activeEl === el) hide() }
    el.addEventListener('mouseenter', el._tooltipEnter)
    el.addEventListener('mouseleave', el._tooltipLeave)
    // A click usually changes what's under the pointer (view switch, menu
    // opening, the element itself unmounting) — don't leave a stale tip.
    el.addEventListener('mousedown', el._tooltipLeave)
  },
  updated(el, binding) {
    setText(el, binding.value)
    if (activeEl !== el) return
    if (!el._tooltipText) hide()
    else if (tip?.classList.contains('visible')) show(el)
  },
  beforeUnmount(el) {
    if (activeEl === el) hide()
    if (el._tooltipEnter) el.removeEventListener('mouseenter', el._tooltipEnter)
    if (el._tooltipLeave) {
      el.removeEventListener('mouseleave', el._tooltipLeave)
      el.removeEventListener('mousedown', el._tooltipLeave)
    }
  },
}

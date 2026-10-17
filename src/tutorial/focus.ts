import { ref } from 'vue'

// The currently focused element, as reactive state — so a step's done()
// can react to focus moving (e.g. Enter in the title jumping into the sub
// field), which document.activeElement alone wouldn't trigger. Tracked
// only while the tour runs (see useTutorial.ts).
const focusedEl = ref<Element | null>(null)
function onFocusChange() { focusedEl.value = document.activeElement }

export function startFocusTracking() {
  document.addEventListener('focusin', onFocusChange)
  document.addEventListener('focusout', onFocusChange)
}

export function stopFocusTracking() {
  document.removeEventListener('focusin', onFocusChange)
  document.removeEventListener('focusout', onFocusChange)
  focusedEl.value = null
}

export function focusIn(selector: string): boolean {
  return !!focusedEl.value?.closest(selector)
}

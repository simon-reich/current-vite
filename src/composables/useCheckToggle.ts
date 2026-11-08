import { useChecksStore, type Check } from '../stores/checks'
import { useThemeStore } from '../stores/theme'
import { burstCheckbox } from './useCheckboxBurst'

// Ticking/unticking a Check for one day, from its checkbox — Current's
// check row and the calendar's checks box (catching up on a past day)
// both go through here. Sparks on ticking only, gated like every other
// celebration on celebrationsEnabled.
export function useCheckToggle() {
  const checksStore = useChecksStore()
  const themeStore = useThemeStore()

  return function toggleCheck(check: Check, dateStr: string, el: HTMLElement) {
    const becomingChecked = !checksStore.isCompletedOn(check, dateStr)
    checksStore.toggleCompletion(check.id, dateStr)
    if (becomingChecked && themeStore.celebrationsEnabled) burstCheckbox(el)
  }
}

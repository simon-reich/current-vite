import { useTodosStore, LOOP_TAG_ID } from '../stores/todos'
import { todayStr, addDaysStr } from '../composables/useToday'
import { lastTouched } from '../composables/useTodoSort'

// Dev-only test helper for Current's yesterday leftovers (see stores/
// todos.ts's leftoversFrom) — puts the first few plain pool todos (in
// Overview's default date order, most recently touched first) onto
// yesterday's Date List, as if they'd been left over, so the section can
// be tried out without waiting for midnight. Writes focusDates directly:
// assignFocusDate refuses past dates by design. Only wired up in a dev
// build (see Current.vue's "simulate yesterday" button).
//
// Switched off for now — flip to true to bring the button back for testing.
export const SIMULATE_YESTERDAY_ENABLED = true

export function simulateYesterdayLeftovers(count = 4): number {
  const store = useTodosStore()
  const today = todayStr()
  const yesterday = addDaysStr(today, -1)
  const candidates = store.todos.filter(t =>
    !t.completedAt && !t.deletedAt && !t.tags.includes(LOOP_TAG_ID) &&
    !t.focusDates?.includes(today) && !t.focusDates?.includes(yesterday)
  )
  const picked = [...candidates].sort((a, b) => lastTouched(b).localeCompare(lastTouched(a))).slice(0, count)
  picked.forEach(t => {
    t.focusDates = [...(t.focusDates ?? []), yesterday].sort()
  })
  return picked.length
}

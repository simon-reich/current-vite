import type { Todo } from '../stores/todos'

// Overview's default "date" sort key (AllTodos.vue; also used by
// dev/simulateYesterday.ts to pick the todos Overview shows first) — most
// recently *touched*, not just created. A todo just sent back to the pool via Done-for-now (see
// TodoCard.vue) is exactly the kind of thing you're likely to pick back
// up again soon, so it bubbles to the top the same way a brand-new todo
// would, instead of sitting wherever its original createdAt happens to
// rank. workLog entries are always pushed in chronological order (see
// doneForNow in stores/todos.ts), so the last one is always the most
// recent — and always >= createdAt, so there's no need to compare both.
export function lastTouched(t: Todo): string {
  const base = t.workLog.length ? t.workLog[t.workLog.length - 1] : t.createdAt
  // poolBumpedAt (an expired Date-List todo auto-returned to the pool —
  // see stores/todos.ts's rolloverExpiredFocusDates) bubbles it back to
  // the top the same way a fresh Done-for-now would, without faking a
  // real workLog entry that would wrongly show up on the calendar.
  return t.poolBumpedAt && t.poolBumpedAt > base ? t.poolBumpedAt : base
}

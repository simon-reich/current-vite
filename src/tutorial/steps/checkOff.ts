import type { TutorialStep } from '../types'
import { useTodosStore } from '../../stores/todos'
import { snapshotTodos, restoreTodos } from '../snapshot'

export const checkOff: TutorialStep = {
  id: 'check-off',
  title: 'check it off',
  body: "Two ways to check off: done means finished for good. Done for now puts it back in the pool for another day — handy for anything that comes back.",
  hint: 'click a todo and check it off',
  route: '/current',
  target: '.current-view .todo-card-wrap',
  keepClear: '.current-view .todo-wrap',
  enter: () => snapshotTodos('check-off'),
  // Either way counts — done (completedAt) or done for now (workLog).
  done: () => useTodosStore().todos.some(t => t.completedAt || t.workLog.length > 0),
  undo: () => restoreTodos('check-off'),
}

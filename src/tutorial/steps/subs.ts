import type { TutorialStep } from '../types'
import { useTodosStore } from '../../stores/todos'
import { collapseAddTodo, rememberNewestTodo, restoreSavedTodo } from '../ui'

export const subs: TutorialStep = {
  id: 'subs',
  title: 'subs',
  body: 'Enter took you to the subs — small steps inside a todo. Type one and press enter to add it, as many as you like.',
  hint: 'press enter on the empty line to save the todo',
  route: '/all',
  // Just the sub field (desktop dropdown or phone sheet, whichever is on
  // screen).
  target: '.add-sub-input-wrap',
  done: () => useTodosStore().activeTodos.length > 0,
  onDone: () => {
    rememberNewestTodo()
    collapseAddTodo()
  },
  // Back from the next step: the saved todo goes back into the input,
  // caret in the sub field — right where this step left off.
  back: () => { restoreSavedTodo('sub') },
}

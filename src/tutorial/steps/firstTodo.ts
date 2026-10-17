import type { TutorialStep } from '../types'
import { todoDraftTitle } from '../../composables/useTodoDraftRequest'
import { useTodosStore } from '../../stores/todos'
import { focusIn } from '../focus'
import { ADD_FIELD, enterAddTitle, focusAddTitle, restoreSavedTodo } from '../ui'

export const firstTodo: TutorialStep = {
  id: 'first-todo',
  title: 'your first todo',
  body: 'Everything starts in the pool — one list of all your todos. Adding one is just typing.',
  hint: 'type a title and press enter',
  route: '/all',
  // The whole add field incl. its open dropdown (desktop/tablet), on
  // phone the sheet's title row once open, the plus button before that.
  target: ['.add-wrapper', '.add-sheet.open .add-sheet-title-row', '.phone-overview-add-btn'],
  // Enter in the title moves on to the subs field (see the subs step) —
  // that already counts, as does a todo saved some other way. Same check
  // stamp and short pause as every other done step.
  done: () => focusIn('.add-sub-input') || useTodosStore().activeTodos.length > 0,
  // Back from the subs step: the todo (if already saved) goes back into
  // the input, caret in the title.
  back: () => { if (!restoreSavedTodo('title')) focusAddTitle() },
  // Moving on to the subs needs a title typed and the add field open
  // (focus in it) — closed, the subs can't be reached from here.
  redo: enterAddTitle,
  ready: () => !!todoDraftTitle.value.trim() && focusIn(ADD_FIELD),
}

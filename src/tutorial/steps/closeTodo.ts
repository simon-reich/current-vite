import type { TutorialStep } from '../types'
import { useTodosStore } from '../../stores/todos'
import { closeTodoCard, isTodoCardOpen, openTourTodoCard, tourTodo } from '../ui'

function hasUserTag() {
  const store = useTodosStore()
  const userTagIds = new Set(store.userTags.map(t => t.id))
  return !!tourTodo()?.tags.some(id => userTagIds.has(id))
}

export const closeTodo: TutorialStep = {
  id: 'close-todo',
  title: 'close it',
  body: 'Your new tag is already picked — it sticks once you close the todo. Closing is just a click anywhere outside it.',
  hint: 'click outside the todo',
  route: '/all',
  // Nothing to point at (anywhere outside counts) — but the open todo
  // stays in view.
  keepClear: '.todo-card-wrap.tag-editing',
  // Tags only land on the todo when its card closes (see TodoCard.vue's
  // staged draftTags) — so "done" is the tag actually on it.
  done: hasUserTag,
  // Next closes the card for the user, applying the picked tag — needs
  // the card open and a tag made.
  ready: () => isTodoCardOpen() && useTodosStore().userTags.length > 0,
  redo: closeTodoCard,
  // Back from the next step: the card opens again, with the tag on it.
  back: openTourTodoCard,
}

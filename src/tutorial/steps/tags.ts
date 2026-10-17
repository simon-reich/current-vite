import type { TutorialStep } from '../types'
import { useTodosStore } from '../../stores/todos'
import { closeTodoCard, isTodoCardOpen, openTourTodoCard, tourTodo } from '../ui'

function hasUserTag() {
  const store = useTodosStore()
  const userTagIds = new Set(store.userTags.map(t => t.id))
  return !!tourTodo()?.tags.some(id => userTagIds.has(id))
}

export const tags: TutorialStep = {
  id: 'tags',
  title: 'tags',
  body: "Tags group your todos — work, home, whatever fits. Make one right here in the open todo: it's picked right away and sticks once you close the todo with a click anywhere outside it.",
  hint: 'add a tag with {plus}, then click outside the todo',
  route: '/all',
  // The + in the open card — once a tag exists nothing pulses: closing
  // is a click anywhere outside the card, there's no one control for it.
  target: () => useTodosStore().userTags.length
    ? []
    : ['.todo-card-wrap.tag-editing .tag-row-add-editing', '.todo-card-wrap.tag-editing .tag-row-add-btn'],
  // The card stays clear of the whole open todo, not just the + — the tag
  // being typed, the tags around it.
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

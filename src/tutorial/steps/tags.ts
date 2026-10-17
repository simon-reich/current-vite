import type { TutorialStep } from '../types'
import { useTodosStore } from '../../stores/todos'
import { openTourTodoCard } from '../ui'

export const tags: TutorialStep = {
  id: 'tags',
  title: 'tags',
  body: 'Tags group your todos — work, home, whatever fits. Make one right here in the open todo.',
  hint: 'add a tag with {plus}',
  route: '/all',
  // The + in the open card.
  target: ['.todo-card-wrap.tag-editing .tag-row-add-editing', '.todo-card-wrap.tag-editing .tag-row-add-btn'],
  // The card stays clear of the whole open todo, not just the + — the tag
  // being typed, the tags around it.
  keepClear: '.todo-card-wrap.tag-editing',
  // A new tag is picked for the open todo right away, so having made one
  // is the step done; it only lands on the todo once the card closes —
  // that's the next step (closeTodo.ts).
  done: () => useTodosStore().userTags.length > 0,
  // Back from closing: the card opens again, with the tag picked.
  back: openTourTodoCard,
}

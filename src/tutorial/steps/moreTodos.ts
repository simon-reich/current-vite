import type { TutorialStep } from '../types'
import { seedTodos, unseedTodos } from '../seed'

export const moreTodos: TutorialStep = {
  id: 'more-todos',
  title: 'a few more',
  body: 'So there is something to group, the tour just added a few todos — some for work, some for home, one with your own tag.',
  route: '/all',
  enter: seedTodos,
  // Re-reached via back from the filter step: they're still there.
  back: seedTodos,
  undo: unseedTodos,
}

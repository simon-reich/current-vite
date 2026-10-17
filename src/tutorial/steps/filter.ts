import type { TutorialStep } from '../types'
import { useTodosStore } from '../../stores/todos'
import { activeTagIds } from '../../composables/useTagFilter'

function userTagIds() {
  return new Set(useTodosStore().userTags.map(t => t.id))
}

export const filter: TutorialStep = {
  id: 'filter',
  title: 'filter',
  body: "Pick a tag in the tag list to see only its todos — several at once work too. 'all' brings everything back.",
  hint: 'show only the todos of one tag',
  route: '/all',
  // Desktop: the tag column at the side; tablet/phone: the tags panel
  // once open, the tags button before that.
  target: ['.sidebar-right .tag-list', '.mobile-tags-panel .mobile-tag-chip-wrap', '.mobile-tags-btn'],
  done: () => { const ids = userTagIds(); return activeTagIds.value.some(id => ids.has(id)) },
  // Next filters by the first tag for the user.
  ready: () => useTodosStore().userTags.length > 0,
  redo: () => { const first = useTodosStore().userTags[0]; if (first) activeTagIds.value = [first.id] },
  // Back to the seeded todos: unfiltered again, as it was there.
  undo: () => { activeTagIds.value = [] },
}

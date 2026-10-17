import type { TutorialStep } from '../types'
import { useTodosStore } from '../../stores/todos'
import { useThemeStore } from '../../stores/theme'
import { todayStr } from '../../composables/useToday'
import { activeTagIds } from '../../composables/useTagFilter'
import { snapshotTodos, restoreTodos } from '../snapshot'
import { tourTodo } from '../ui'

const PLAN_COUNT = 2

function onTodaysList() {
  return useTodosStore().todosForFocusDate(todayStr()).length
}

// The filter from the step before, set aside while planning (the whole
// pool should be in view) and put back when going back there.
let filterBefore: string[] = []

export const planDay: TutorialStep = {
  id: 'plan-day',
  title: 'plan your day',
  body: 'Date lists are your plan for a day. The date at the top picks which day — today for now — and {plus} on a todo puts it on that list.',
  hint: `put ${PLAN_COUNT} todos on today's list`,
  route: '/all',
  target: '.content-inner .card-btn[aria-label="add to list"]',
  enter: () => {
    snapshotTodos('plan-day')
    filterBefore = [...activeTagIds.value]
    activeTagIds.value = []
    useThemeStore().setSelectedFocusDate(todayStr())
  },
  done: () => onTodaysList() >= PLAN_COUNT,
  // Next fills the list up for the user — your todo first, then the
  // newest of the rest.
  redo: () => {
    const store = useTodosStore()
    const today = todayStr()
    const own = tourTodo()
    const candidates = [own, ...store.activeTodos.filter(t => t.id !== own?.id)].filter(Boolean)
    for (const todo of candidates) {
      if (onTodaysList() >= PLAN_COUNT) break
      if (todo && !todo.focusDates?.includes(today)) store.assignFocusDate(todo.id, today)
    }
  },
  undo: () => {
    restoreTodos('plan-day')
    activeTagIds.value = filterBefore
  },
}

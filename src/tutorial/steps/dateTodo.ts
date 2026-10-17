import type { TutorialStep } from '../types'
import { useTodosStore, LOOP_TAG_ID } from '../../stores/todos'
import { todayStr } from '../../composables/useToday'
import { snapshotTodos, restoreTodos } from '../snapshot'
import { seededTodo } from '../seed'
import { closeTodoCard, isTodoCardOpen, openTodoCard } from '../ui'
import { domFind, domFindByText } from '../dom'

// The three date steps all work on one seeded todo.
const TITLE = 'Water the plants'
const plant = () => seededTodo(TITLE)
const cardSel = () => `.todo-card-wrap:has(.todo-card[data-todo-id="${plant()?.id}"])`
const openCardSel = () => `${cardSel()}.tag-editing`

const plantOpen = () => !!plant() && isTodoCardOpen() && !!domFind(openCardSel())
const pickerOpen = () => plantOpen() && !!domFind(`${openCardSel()} .loop-picker`)
const activeOpt = (label: string) => !!domFindByText(`${openCardSel()} .loop-opt.active`, label)

function clickByText(selector: string, text: string) {
  domFindByText(selector, text)?.click()
}

function openPlant() {
  const todo = plant()
  if (todo) openTodoCard(todo.id)
}

export const dateTodo: TutorialStep = {
  id: 'date-todo',
  title: 'dates',
  body: 'A todo can get a date: then it plans itself and lands on the list of its day all on its own. The date tag adds one.',
  hint: `open “${TITLE}” and pick date`,
  route: '/all',
  // The todo while closed, its date tag once open.
  target: () => plantOpen()
    ? [`${openCardSel()} .tag-row-pinned .tag-row-opt:last-child`]
    : [cardSel()],
  keepClear: () => plantOpen() ? openCardSel() : cardSel(),
  enter: () => snapshotTodos('date-todo'),
  done: pickerOpen,
  // Next opens the todo and picks date for the user.
  ready: () => !!plant(),
  redo: () => {
    openPlant()
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const label = domFindByText(`${openCardSel()} .tag-row-pinned .tag-row-opt`, 'date')
      label?.querySelector('input')?.click()
    }))
  },
  back: openPlant,
  undo: () => {
    closeTodoCard()
    restoreTodos('date-todo')
  },
}

export const loopTodo: TutorialStep = {
  id: 'loop-todo',
  title: 'once or loop',
  body: 'Once is a single day. Loop brings it back by itself — daily, weekly, on certain weekdays — made for routines.',
  hint: 'choose loop (daily is preset)',
  route: '/all',
  target: () => [`${openCardSel()} .loop-picker .loop-row:first-child .loop-opt:last-child`],
  keepClear: openCardSel,
  done: () => pickerOpen() && activeOpt('loop') && activeOpt('daily'),
  ready: pickerOpen,
  redo: () => {
    clickByText(`${openCardSel()} .loop-opt`, 'loop')
    requestAnimationFrame(() => {
      if (!activeOpt('daily')) clickByText(`${openCardSel()} .loop-opt`, 'daily')
    })
  },
  back: openPlant,
}

export const dateLands: TutorialStep = {
  id: 'date-lands',
  title: 'it plans itself',
  body: "Daily from today means it's due right now — close the todo and watch it land on today's list by itself. Tomorrow it'll be back.",
  hint: 'click outside the todo',
  route: '/all',
  keepClear: () => plantOpen() ? openCardSel() : '.content-inner .todo-wrap',
  done: () => {
    const todo = plant()
    return !!todo && todo.tags.includes(LOOP_TAG_ID) && todo.loopInterval?.mode === 'loop'
      && useTodosStore().todosForFocusDate(todayStr()).some(t => t.id === todo.id)
  },
  ready: plantOpen,
  redo: closeTodoCard,
  back: openPlant,
}

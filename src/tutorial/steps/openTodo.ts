import type { TutorialStep } from '../types'
import { useTodosStore } from '../../stores/todos'
import { closeTodoCard, isTodoCardOpen, openTourTodoCard } from '../ui'

export const openTodo: TutorialStep = {
  id: 'open-todo',
  title: 'open it',
  body: 'A click on a todo opens it — that is where you manage it: edit the title, add subs, tags or a date.',
  hint: 'click your todo',
  route: '/all',
  target: '.content-inner .todo-card-wrap',
  done: isTodoCardOpen,
  // Next opens it for the user — needs a todo to open.
  ready: () => useTodosStore().activeTodos.length > 0,
  redo: openTourTodoCard,
  // Back from the tag step: the card closes again — which commits whatever
  // tags were picked in it, so nothing entered is lost.
  back: closeTodoCard,
}

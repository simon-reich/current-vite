import type { TutorialStep } from '../types'

export const currentView: TutorialStep = {
  id: 'current-view',
  title: 'current',
  body: "This is Current — the list of one day, today's for now. It's where you work through your plan. The date at the top switches between days.",
  route: '/current',
  keepClear: '.current-view .todo-wrap',
}

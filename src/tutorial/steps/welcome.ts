import type { TutorialStep } from '../types'
import { collapseAddTodo } from '../ui'

export const welcome: TutorialStep = {
  id: 'welcome',
  title: 'welcome',
  body: 'A quick tour through the main ideas. You start in an empty app — your own todos are safe and come back as soon as the tour ends.',
  route: '/all',
  nextLabel: "let's go",
  // Back here from the first todo step: fold the add input away again.
  back: collapseAddTodo,
}

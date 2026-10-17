import type { TutorialStep } from '../types'
import { currentPath, goTo } from '../nav'

export const switchView: TutorialStep = {
  id: 'switch-view',
  title: 'switch views',
  body: "These icons switch between the views: the pool you're in now, Current with your day's list, the calendar and settings.",
  hint: 'open Current',
  route: '/all',
  // Desktop/tablet header or the phone's bottom nav, whichever is shown.
  target: 'a.nav-icon[href$="/current"]',
  done: () => currentPath() === '/current',
  redo: () => goTo('/current'),
}

import type { TutorialStep } from '../types'
import { currentPath, goTo } from '../nav'

// A step that has the user switch views themselves via the nav icons —
// a factory, since the tour does this more than once (to Current, back to
// the pool, ...).
export function switchViewStep(opts: {
  id: string
  from: string
  to: string
  title: string
  body: string
  hint: string
}): TutorialStep {
  return {
    id: opts.id,
    title: opts.title,
    body: opts.body,
    hint: opts.hint,
    route: opts.from,
    // Desktop/tablet header or the phone's bottom nav, whichever is shown.
    target: `a.nav-icon[href$="${opts.to}"]`,
    done: () => currentPath() === opts.to,
    redo: () => goTo(opts.to),
  }
}

export const switchView = switchViewStep({
  id: 'switch-view',
  from: '/all',
  to: '/current',
  title: 'switch views',
  body: "These icons switch between the views: the pool you're in now, Current with your day's list, the calendar and settings.",
  hint: 'open Current',
})

export const backToPool = switchViewStep({
  id: 'back-to-pool',
  from: '/current',
  to: '/all',
  title: 'back to the pool',
  body: 'Todos get edited in the pool — the next thing is a todo that plans itself.',
  hint: 'open the pool',
})

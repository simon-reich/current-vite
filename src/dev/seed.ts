import { uuid } from '../composables/useId'

const TITLES = [
  'Buy groceries for the week',
  'Fix the bug in the authentication flow',
  'Call dentist and schedule appointment',
  'Write unit tests for the new API endpoint',
  'Read chapter 3 of the book',
  'Update README with setup instructions',
  'Plan weekend hiking trip',
  'Review pull request from Sarah',
  'Pay electricity bill',
  'Refactor the user profile component to use Composition API',
  'Water the plants',
  'Prepare slides for Thursday\'s team meeting',
  'Cancel old gym membership',
  'Research best practices for CSS container queries',
  'Buy birthday gift for Mom',
  'Migrate database schema to version 4',
  'Do laundry',
  'Write blog post about the side project',
  'Check and respond to emails',
  'Set up CI/CD pipeline for the new repo',
  'Book flight tickets for conference',
  'Organize downloads folder',
  'Review monthly budget',
  'Add dark mode support to the settings page',
  'Call back Stefan',
  'Document the new onboarding flow for the team wiki',
  'Go for a 30-minute run',
  'Update dependencies and check for breaking changes',
  'Clean up old branches in Git',
  'Sketch wireframe for the mobile checkout redesign',
]

export function seedDevData() {
  if (!import.meta.env.DEV) return
  try {
    const existing = localStorage.getItem('todos')
    if (existing) {
      const parsed = JSON.parse(existing)
      if (parsed?.todos?.length > 0) return
    }
  } catch { /* corrupt data – overwrite */ }

  const now = new Date()
  const todos = TITLES.map((title, i) => ({
    id: uuid(),
    title,
    tags: [],
    createdAt: new Date(now.getTime() - i * 60_000).toISOString(),
    inCurrent: i % 5 === 0,
    completedAt: undefined,
    subs: [],
    workLog: [],
  }))

  localStorage.setItem('todos', JSON.stringify({
    todos,
    tags: [],
  }))
}

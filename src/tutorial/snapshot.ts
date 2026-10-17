import { useTodosStore } from '../stores/todos'

// Snapshots of the sandbox's todos and tags, keyed by step — a step takes
// one in enter() and puts it back in undo(), so leaving it backwards takes
// back everything done during it (list assignments, check-offs, ...) in
// one go, without each step tracking its own changes.
const snapshots = new Map<string, string>()

export function snapshotTodos(key: string) {
  const store = useTodosStore()
  snapshots.set(key, JSON.stringify({ todos: store.todos, tags: store.tags }))
}

export function restoreTodos(key: string) {
  const raw = snapshots.get(key)
  if (!raw) return
  const { todos, tags } = JSON.parse(raw)
  const store = useTodosStore()
  store.todos = todos
  store.tags = tags
  snapshots.delete(key)
}

export function forgetSnapshots() {
  snapshots.clear()
}

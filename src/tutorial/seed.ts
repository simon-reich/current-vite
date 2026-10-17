import { useTodosStore } from '../stores/todos'
import { tourTodo } from './ui'

// The few extra todos the tour adds once the first one has a tag — always
// the same ones, so every run of the tour looks alike. `tag` 'own' means
// the tag the user made in the tags step.
const SEED_TODOS: { title: string; tag: 'work' | 'home' | 'own' }[] = [
  { title: 'Answer emails', tag: 'work' },
  { title: 'Prepare the team meeting', tag: 'work' },
  { title: 'Buy groceries', tag: 'home' },
  { title: 'Water the plants', tag: 'home' },
  { title: 'Book a train ticket', tag: 'own' },
]

let seededTodoIds: string[] = []
let seededTagIds: string[] = []

export function seedTodos() {
  if (seededTodoIds.length) return
  const store = useTodosStore()
  const ownTagIds = new Set(store.userTags.map(t => t.id))
  const ownTag = tourTodo()?.tags.find(id => ownTagIds.has(id)) ?? null
  const tagId = (label: 'work' | 'home') => {
    const existing = store.tags.find(t => t.label.toLowerCase() === label)
    if (existing) return existing.id
    const tag = store.addTag(label)
    seededTagIds.push(tag.id)
    return tag.id
  }
  // Oldest first, so the list (newest first) shows them in the order above.
  for (const seed of [...SEED_TODOS].reverse()) {
    const tag = seed.tag === 'own' ? ownTag : tagId(seed.tag)
    seededTodoIds.push(store.addTodo(seed.title, { tags: tag ? [tag] : [] }).id)
  }
}

export function unseedTodos() {
  const store = useTodosStore()
  seededTodoIds.forEach(id => store.deleteTodo(id))
  seededTagIds.forEach(id => store.deleteTag(id))
  seededTodoIds = []
  seededTagIds = []
}

export function forgetSeed() {
  seededTodoIds = []
  seededTagIds = []
}

// Which frame-animation celebration (see TodoCard.vue's "Celebration-
// Animationen" section) each Todo gets is decided once, when it's sent to
// Current (see stores/todos.ts's sendToCurrent) — not re-rolled every time its
// check-menu happens to open. Living here rather than in TodoCard.vue lets
// the store assign a key without importing anything animation/SVG-related;
// TodoCard.vue's own ALL_CELEBRATIONS (importer/size/duration/anchor per
// key) is the only place that needs to know what a key actually renders as.
// 'whale' is currently taken out of the pool (its ALL_CELEBRATIONS entry in
// TodoCard.vue is commented out too) — add it back to both to re-enable.
export const CELEBRATION_KEYS = ['blackCat', /* 'whale', */ 'penguin', 'orca'] as const
export type CelebrationKey = typeof CELEBRATION_KEYS[number]


// Shuffle-bag — guarantees every one turns up once per full cycle instead
// of the same one occasionally repeating several times in a row, same
// trick as TodoCard.vue's old particle-effect bag.
let bag: CelebrationKey[] = []

export function drawCelebrationKey(): CelebrationKey {
  if (bag.length === 0) {
    const shuffled = [...CELEBRATION_KEYS]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    bag = shuffled
  }
  return bag.pop()!
}

// The one place that decides whether a stored celebration key is still
// valid. Celebrations get added and retired over time (the plain 'cat',
// 'whale' for now), but a persisted Todo.celebration — or one from an
// imported JSON — keeps whatever key it was given back then, so it's typed
// CelebrationKey without any guarantee it still is one. Everything that
// reads Todo.celebration goes through ensureCelebrationKey, never through
// its own lookup/fallback.
export function isCelebrationKey(key: string | undefined): key is CelebrationKey {
  return (CELEBRATION_KEYS as readonly string[]).includes(key as string)
}

// The key itself if it's still in the pool, otherwise a freshly drawn one
// (also for a todo that never got one). Callers that can persist the
// result (App.vue's teaser watcher) do, so teaser and real celebration
// stay the same one.
export function ensureCelebrationKey(key: string | undefined): CelebrationKey {
  return isCelebrationKey(key) ? key : drawCelebrationKey()
}

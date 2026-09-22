<script setup lang="ts">
import { inject, computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useTodosStore, LOOP_TAG_ID, type Todo } from '../stores/todos'
import { useThemeStore } from '../stores/theme'
import TodoCard from '../components/TodoCard.vue'
import { assignFonts } from '../composables/useTodoFonts'
import { useListFlip } from '../composables/useListFlip'
import { spawnSentToCurrentToast, spawnPlannedForDateToast } from '../composables/useToast'
import { nextLoopOccurrence } from '../composables/useLoopSchedule'

const store = useTodosStore()
const themeStore = useThemeStore()
// Already unions loop in when loopFilterMode is "only" — see App.vue,
// which also drives the All/Prio/tag-chip active/dimmed state off this
// exact same computed, so what's highlighted always matches what's
// actually shown.
const effectiveFilterTagIds = inject<Ref<string[]>>('effectiveFilterTagIds')!
const loopFilterMode = inject<Ref<'default' | 'only' | 'hide'>>('loopFilterMode')!
const sortKey = inject<Ref<'createdAt' | 'title'>>('sortKey')!
const listView = inject<Ref<boolean>>('listView')!

// Bumped whenever the grid/list toggle or the sort order changes, folded
// into each card's :key below so the whole set remounts and replays its
// entrance animation — otherwise Vue just reorders/restyles the existing
// instances without ever re-triggering it.
const renderGen = ref(0)
watch([listView, sortKey], () => { renderGen.value++ })

// A–Z sort should order by actual letters/numbers only — punctuation
// (quotes, dashes, ...) at the start of a title was outranking every
// letter and digit under plain localeCompare, since symbols collate
// before alphanumerics. Stripping everything but letters/digits first
// means a title's sort position is driven by its first real character;
// `numeric: true` then sorts number runs by value (2 before 10) instead
// of lexically (10 before 2).
function alphaSortKey(title: string): string {
  return title.replace(/[^\p{L}\p{N}]+/gu, '')
}

// The default "date" sort's own key — most recently *touched*, not just
// created. A todo just sent back to the pool via Done-for-today (see
// TodoCard.vue) is exactly the kind of thing you're likely to pick back
// up again soon, so it bubbles to the top the same way a brand-new todo
// would, instead of sitting wherever its original createdAt happens to
// rank. workLog entries are always pushed in chronological order (see
// doneForToday in stores/todos.ts), so the last one is always the most
// recent — and always >= createdAt, so there's no need to compare both.
function lastTouched(t: Todo): string {
  const base = t.workLog.length ? t.workLog[t.workLog.length - 1] : t.createdAt
  // poolBumpedAt (an expired Date-List todo auto-returned to the pool —
  // see stores/todos.ts's rolloverExpiredFocusDates) bubbles it back to
  // the top the same way a fresh Done-for-today would, without faking a
  // real workLog entry that would wrongly show up on the calendar.
  return t.poolBumpedAt && t.poolBumpedAt > base ? t.poolBumpedAt : base
}

// Date todos' own sort key while the Date filter is "only" — how soon
// they're next due, soonest first, so glancing at that filtered view
// reads as a lightweight timeline. Infinity for anything without a
// loopInterval (still possible here: "only" unions loop in with whatever
// other tags are active — see effectiveFilterTagIds — rather than
// excluding them), which sorts those to the very end instead of erroring.
function nextOccurrenceKey(t: Todo): number {
  if (!t.loopInterval) return Infinity
  return nextLoopOccurrence(t.loopInterval)?.getTime() ?? Infinity
}

// With Date Lists on, a todo being inCurrent no longer pulls it out of
// Overview — that's what let you distribute a single todo across multiple
// lists (Current included) in the first place, instead of it vanishing the
// moment it joins any one of them. Date Lists off collapses back to the
// original single-Current-pool app exactly: sending something to Current
// is the only "list" that exists, so it should still visibly leave Overview.
const filteredTodos = computed(() => {
  let result = themeStore.dateListsEnabled ? [...store.activeTodos] : store.activeTodos.filter(t => !t.inCurrent)
  if (effectiveFilterTagIds.value.length > 0) {
    result = result.filter(t => t.tags.some(tid => effectiveFilterTagIds.value.includes(tid)))
  }
  // Hide is a standing exclusion on top of whatever the union above
  // already selected — not an additional AND alongside "only" (which no
  // longer exists as a separate branch; it's folded into the union).
  if (loopFilterMode.value === 'hide') {
    result = result.filter(t => !t.tags.includes(LOOP_TAG_ID))
  }
  // "only" replaces the normal date/A–Z toggle entirely with next-due-
  // first — a dedicated timeline view of what's coming up, not just
  // another flavor of the regular sort.
  if (loopFilterMode.value === 'only') {
    return [...result].sort((a, b) => nextOccurrenceKey(a) - nextOccurrenceKey(b))
  }
  return [...result].sort((a, b) =>
    sortKey.value === 'title'
      ? alphaSortKey(a.title).localeCompare(alphaSortKey(b.title), 'de', { numeric: true })
      : lastTouched(b).localeCompare(lastTouched(a))
  )
})

const fontMap = computed(() => assignFonts(filteredTodos.value.map(t => t.id)))
const siblingIds = computed(() => filteredTodos.value.map(t => t.id))

useListFlip(() => siblingIds.value, '.todo-wrap')

// A card leaving Overview for Current (Enter a second time on an already-
// open card, or a swipe) otherwise just vanishes from this list with no
// explanation — reads like the card closed rather than moved. The toast
// rises from the card's own position, so it's clear where it went
// instead. Not shown for a direct "+" button click (`obvious`) — that one
// already makes the move plain on its own.
function sendToCurrent(id: string, obvious?: boolean) {
  if (!obvious) spawnSentToCurrentToast(id)
  store.sendToCurrent(id)
}

// Per-card calendar-icon quick-assign (see TodoCard.vue's CalendarPlus
// button) and the swipe-split's top zone both plan a todo onto the
// widget's currently selected date — see stores/todos.ts's Date Lists
// section. Doesn't touch `inCurrent`, so the card stays right here in
// Overview (see the plan's "Overview bleibt unberührt" guarantee).
function sendToFocusDate(id: string) {
  store.assignFocusDate(id, themeStore.selectedFocusDate)
  spawnPlannedForDateToast(id, themeStore.selectedFocusDate)
}
</script>

<template>
  <div class="all-todos" :class="{ 'list-view': listView }">
    <div v-if="filteredTodos.length" class="todo-wrap" :class="{ 'list-view': listView }">
      <TodoCard
        v-for="(todo, index) in filteredTodos"
        :key="`${todo.id}-${renderGen}`"
        :data-flip-id="todo.id"
        :todo="todo"
        :font="fontMap.get(todo.id)"
        :sibling-ids="siblingIds"
        :index="index"
        :grid-mode="true"
        :force-expand-subs="themeStore.expandOverviewSubs"
        mode="all"
        @send-to-current="sendToCurrent"
        @send-to-focus-date="sendToFocusDate"
        @remove-from-current="store.removeFromCurrent($event)"
        @delete="store.deleteTodo($event)"
      />
    </div>
    <p v-else class="empty">
      {{ (themeStore.dateListsEnabled ? store.activeTodos.length : store.activeTodos.filter(t => !t.inCurrent).length) === 0 && effectiveFilterTagIds.length === 0 ? 'No todos yet.' : 'No todos for this filter.' }}
    </p>
  </div>
</template>

<style scoped>
.all-todos {
  width: 100%;
  max-width: min(70vw, 1100px);
}

.all-todos.list-view {
  max-width: 640px;
}

.todo-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.todo-wrap.list-view {
  flex-direction: column;
  flex-wrap: nowrap;
  align-items: flex-start;
  justify-content: flex-start;
  max-width: 640px;
}

@media (max-width: 700px) {
  .all-todos {
    max-width: 100%;
  }
  .todo-wrap {
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: flex-start;
    justify-content: flex-start;
  }
}

/* Tablet: cards stay in a wrapping grid (unlike phone's single column),
   but the reading-width cap needs to go so more of them fit per row. */
@media (min-width: 701px) and (max-width: 1024px) {
  .all-todos {
    max-width: 100%;
  }
  .todo-wrap {
    gap: 8px;
  }

  /* Grid mode already spans the full row so centering is moot, but list
     mode keeps its 640px reading-width cap — content-inner's align-items:
     center then centers that narrower block, so its left edge drifts
     depending on how much wider than 640px the row happens to be at a
     given tablet width, instead of lining up with the top-menu's icons.
     Pin it to the left, offset to match main-head's own left padding
     (20px) against content-inner's (6px). */
  .all-todos.list-view {
    align-self: flex-start;
    margin-left: 14px;
  }
}

.empty {
  color: var(--ink);
  font-size: 15px;
  text-align: center;
  margin-top: 24px;
}
</style>

<script setup lang="ts">
import { inject, computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useTodosStore, LOOP_TAG_ID, type Todo } from '../stores/todos'
import { useThemeStore } from '../stores/theme'
import TodoCard from '../components/TodoCard.vue'
import ActiveFilterChips from '../components/ActiveFilterChips.vue'
import { assignFonts } from '../composables/useTodoFonts'
import { useListFlip } from '../composables/useListFlip'
import { nextLoopDue, isLoopSettledToday } from '../composables/useLoopSchedule'
import { lastTouched } from '../composables/useTodoSort'
import { useFocusDateNav } from '../composables/useFocusDateNav'

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

// Date todos' own sort key while the Date filter is "only" — how soon
// they're next due, soonest first, so glancing at that filtered view
// reads as a lightweight timeline. Infinity for anything without a
// loopInterval (still possible here: "only" unions loop in with whatever
// other tags are active — see effectiveFilterTagIds — rather than
// excluding them), which sorts those to the very end instead of erroring.
function nextOccurrenceKey(t: Todo): number {
  if (!t.loopInterval) return Infinity
  return nextLoopDue(t.loopInterval, isLoopSettledToday(t))?.getTime() ?? Infinity
}

// With Date Lists on, a todo being inCurrent no longer pulls it out of
// Overview — that's what let you distribute a single todo across multiple
// lists (Current included) in the first place, instead of it vanishing the
// moment it joins any one of them. Date Lists off collapses back to the
// original single-Current-pool app exactly: sending something to Current
// is the only "list" that exists, so it should still visibly leave Overview.
// Todos on the Date List currently picked in the focus-date pill — planned
// there (focusDates) or a Date todo due that day, same live definition as
// the list's own preview (todosForFocusDate). Read off existing data only,
// nothing extra stored. Empty without Date Lists, so the sort below is
// unchanged then.
const onSelectedListIds = computed(() => themeStore.dateListsEnabled
  ? new Set(store.todosForFocusDate(themeStore.selectedFocusDate).map(t => t.id))
  : new Set<string>())

const filteredTodos = computed(() => {
  let result = themeStore.dateListsEnabled ? [...store.activeTodos] : store.activeTodos.filter(t => !t.inCurrent)
  if (effectiveFilterTagIds.value.length > 0) {
    result = result.filter(t => t.tags.some(tid => effectiveFilterTagIds.value.includes(tid)))
  }
  // Hide is a standing exclusion on top of whatever the union above
  // already selected — not an additional AND alongside "only" (which no
  // longer exists as a separate branch; it's folded into the union).
  // Exempts the selected Date List's own todos (onSelectedListIds), so a
  // Date todo due that day still shows up in the list's section above the
  // pool — hiding Date todos is about decluttering the pool, not the list.
  if (loopFilterMode.value === 'hide') {
    const onList = onSelectedListIds.value
    result = result.filter(t => !t.tags.includes(LOOP_TAG_ID) || onList.has(t.id))
  }
  // "only" replaces the normal date/A–Z toggle entirely with next-due-
  // first — a dedicated timeline view of what's coming up, not just
  // another flavor of the regular sort.
  if (loopFilterMode.value === 'only') {
    return [...result].sort((a, b) => nextOccurrenceKey(a) - nextOccurrenceKey(b))
  }
  const onList = onSelectedListIds.value
  return [...result].sort((a, b) =>
    // Todos on the selected Date List first, the rest after — each group
    // keeps the normal date/A–Z order below.
    Number(onList.has(b.id)) - Number(onList.has(a.id)) ||
    (sortKey.value === 'title'
      ? alphaSortKey(a.title).localeCompare(alphaSortKey(b.title), 'de', { numeric: true })
      : lastTouched(b).localeCompare(lastTouched(a)))
  )
})

// Index of the first todo *not* on the selected Date List — where the
// visual break goes. Only when both groups are non-empty (and the sort
// actually put the list's todos first, i.e. not in the Date filter's
// "only" mode); -1 = no break.
const selectedListBoundary = computed(() => {
  if (loopFilterMode.value === 'only') return -1
  const onList = onSelectedListIds.value
  const i = filteredTodos.value.findIndex(t => !onList.has(t.id))
  return i > 0 ? i : -1
})

// Caption on the divider: the selected list's date, worded exactly like
// its entry in the sidebar's Date-List nav (today / tomorrow / 04|10
// sunday), so scrolling past it reads the same as the nav.
// Where the active-filter chips (ActiveFilterChips.vue) sit: right above
// the pool — below the selected Date List's divider with Date Lists on,
// otherwise (or in the Date filter's "only" mode, which has no divider)
// simply on top. If every visible todo is on the selected list, there's no
// pool left, so they trail the list instead (index === length).
const filterChipsIndex = computed(() => {
  if (!themeStore.dateListsEnabled || loopFilterMode.value === 'only') return 0
  const onList = onSelectedListIds.value
  const i = filteredTodos.value.findIndex(t => !onList.has(t.id))
  return i === -1 ? filteredTodos.value.length : i
})

const { formatPresetDate } = useFocusDateNav()
const selectedListLabel = computed(() => formatPresetDate(themeStore.selectedFocusDate))

const fontMap = computed(() => assignFonts(filteredTodos.value.map(t => t.id)))
const siblingIds = computed(() => filteredTodos.value.map(t => t.id))

useListFlip(() => siblingIds.value, '.todo-wrap')

function sendToCurrent(id: string) {
  store.sendToCurrent(id)
}

// Per-card calendar-icon quick-assign (see TodoCard.vue's CalendarPlus
// button) and the swipe-split's top zone both plan a todo onto the
// widget's currently selected date — see stores/todos.ts's Date Lists
// section. Doesn't touch `inCurrent`, so the card stays right here in
// Overview (see the plan's "Overview bleibt unberührt" guarantee).
function sendToFocusDate(id: string) {
  store.assignFocusDate(id, themeStore.selectedFocusDate)
}

// Counterpart for the per-card icon/swipe-zone's Remove state once Date
// Lists are on (see TodoCard.vue's isOnSelectedFocusDate) — same "doesn't
// touch inCurrent, card stays right here" guarantee as sendToFocusDate
// above.
function unassignFocusDate(id: string) {
  store.unassignFocusDate(id, themeStore.selectedFocusDate)
}
</script>

<template>
  <div class="all-todos" :class="{ 'list-view': listView }">
    <div v-if="filteredTodos.length" class="todo-wrap" :class="{ 'list-view': listView }">
      <template v-for="(todo, index) in filteredTodos" :key="`${todo.id}-${renderGen}`">
      <!-- Sets the selected Date List's todos (sorted first, see
           onSelectedListIds) apart from the rest as their own little pool.
           Lives inside the same .todo-wrap rather than splitting the list
           in two, so useListFlip still animates cards across the boundary;
           full-width, so in grid mode it also forces a row break. -->
      <div v-if="index === selectedListBoundary" class="selected-list-break">
        <span class="selected-list-break-label">{{ selectedListLabel }}</span>
        <div class="selected-list-break-line" aria-hidden="true" />
      </div>
      <ActiveFilterChips v-if="index === filterChipsIndex" />
      <TodoCard
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
        @unassign-focus-date="unassignFocusDate"
        @move-to-next-day="store.moveFocusDateToNextDay($event, themeStore.selectedFocusDate)"
        @remove-from-current="store.removeFromCurrent($event)"
        @delete="store.deleteTodo($event)"
      />
      </template>
      <ActiveFilterChips v-if="filterChipsIndex === filteredTodos.length" />
    </div>
    <template v-else>
      <ActiveFilterChips />
      <p class="empty">
        {{ (themeStore.dateListsEnabled ? store.activeTodos.length : store.activeTodos.filter(t => !t.inCurrent).length) === 0 && effectiveFilterTagIds.length === 0 ? 'No todos yet.' : 'No todos for this filter.' }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.all-todos {
  width: 100%;
  max-width: min(70vw, 1100px);
}

.all-todos.list-view {
  max-width: 800px;
}

.todo-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

/* Thin pale divider between the selected Date List's pool and the rest,
   captioned (centered, just above the line) with that list's date. The line
   sits visually midway: the space below it matches the space above it
   *including* the caption (its own line-height + gap), minus the drop
   shadow the cards above cast down into that space (--card-shadow-offset)
   — so bottom = top + 1lh + gap - shadow. Font size/line-height live on
   the wrapper itself so 1lh here is the caption's own line box. Full
   width forces a new row in grid mode (width, not flex-basis — the latter
   would mean height in list/column mode). */
.selected-list-break {
  --break-space: 16px;
  --break-caption-gap: 6px;
  width: 100%;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--break-caption-gap);
  margin: var(--break-space) 0 calc(var(--break-space) + 1lh + var(--break-caption-gap) - var(--card-shadow-offset));
  font-family: var(--font-mono, monospace);
  font-size: 16px;
  line-height: 1.3;
}

/* Active-filter chips right below the divider belong to the pool under it,
   so they sit close to the line — only the wrap's own gap in between. */
.selected-list-break:has(+ .active-filters) {
  margin-bottom: 0;
}

.selected-list-break-label {
  font-weight: 700;
  color: var(--ink);
  opacity: 0.5;
}

.selected-list-break-line {
  align-self: stretch;
  height: 2px;
  background: var(--ink);
  opacity: 0.35;
}

/* Full-width row of its own, so in grid mode it forces a row break like the
   divider above it; left-aligned wherever the cards are (list view, phone). */
.todo-wrap > .active-filters {
  width: 100%;
  flex-shrink: 0;
}

.todo-wrap.list-view > .active-filters {
  justify-content: flex-start;
}

.all-todos > .active-filters + .empty {
  margin-top: 16px;
}

.todo-wrap.list-view {
  flex-direction: column;
  flex-wrap: nowrap;
  align-items: flex-start;
  justify-content: flex-start;
  max-width: 800px;
}

/* TodoCard.vue's own .todo-card has a 600px max-width of its own (to stop
   short-title cards stretching absurdly wide in the grid) — that also caps
   list mode's cards short of this wrapper's own, wider max-width above.
   Raised (not removed) here so a card still only ever gets as wide as its
   own content needs, just with more headroom before that cap kicks in.
   Lives inside the child component, not this file's own template, hence
   :deep(). */
.todo-wrap.list-view :deep(.todo-card) {
  max-width: 800px;
}

/* Smaller caption on tablet + phone — set on the wrapper, so the 1lh in
   its bottom margin (see .selected-list-break) shrinks along with it. */
@media (max-width: 1024px) {
  .selected-list-break {
    font-size: 13px;
  }
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
  .todo-wrap > .active-filters {
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
     Pin it to the left — content-inner's own 20px tablet padding already
     matches main-head's, so no extra offset (an extra margin-left on top
     of width: 100% overflowed the right edge and clipped the hover puff
     there). */
  .all-todos.list-view {
    align-self: flex-start;
  }
}

.empty {
  color: var(--ink);
  font-size: 15px;
  text-align: center;
  margin-top: 24px;
}
</style>

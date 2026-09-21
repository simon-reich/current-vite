<script setup lang="ts">
import { computed, ref, inject } from 'vue'
import type { Ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Check, Pencil, ChevronLeft } from '@lucide/vue'
import { useTodosStore, PRIORITY_TAG_ID } from '../stores/todos'
import { useChecksStore, type Check as CheckItem } from '../stores/checks'
import { useThemeStore } from '../stores/theme'
import TodoCard from '../components/TodoCard.vue'
import CheckModal from '../components/CheckModal.vue'
import AllChecksModal from '../components/AllChecksModal.vue'
import ListsPanel from '../components/ListsPanel.vue'
import IconLabelButton from '../components/IconLabelButton.vue'
import { assignFonts } from '../composables/useTodoFonts'
import { useListFlip } from '../composables/useListFlip'
import { spawnRemovedFromCurrentToast } from '../composables/useToast'
import { burstCheckbox } from '../composables/useCheckboxBurst'
import { todayStr } from '../composables/useToday'

const store = useTodosStore()
const checksStore = useChecksStore()
const themeStore = useThemeStore()
const router = useRouter()

// Shared with App.vue's tablet/phone "Lists" trigger buttons (outside the
// RouterView) — see App.vue's own provide for why this goes the opposite
// direction of sortKey/listView.
const listsPanelOpen = inject<Ref<boolean>>('listsPanelOpen')!

// Priority (with or without loop) floats to the top; everything else —
// loop or plain — sorts by when it was actually sent to Current (oldest
// addition first), not by how recently it was created.
function rank(t: { tags: string[] }): number {
  return t.tags.includes(PRIORITY_TAG_ID) ? 0 : 1
}

// Current is deliberately unfilterable — it's already the curated, small
// subset by design, and always shows every todo that's in it regardless
// of whatever All/Prio/Loop/tag filter happens to be active in Overview
// (see App.vue's #app.is-current rules, which gray out that whole filter
// UI here instead of just silently ignoring it).
const defaultCurrentTodos = computed(() => {
  return [...store.currentTodos].sort((a, b) => {
    const rankDiff = rank(a) - rank(b)
    if (rankDiff !== 0) return rankDiff
    // Falls back to createdAt for todos already in Current from before
    // focusAddedAt existed.
    return (a.focusAddedAt ?? a.createdAt).localeCompare(b.focusAddedAt ?? b.createdAt)
  })
})

// null = the default Current list above. Set from App.vue's desktop sidebar
// Date-List nav, or via ListsPanel.vue's picker on tablet/phone — swaps
// this whole view for one other Date List's todos instead of stacking it
// in a separate cramped overlay. Owned by App.vue (its sidebar buttons sit
// outside the RouterView), injected here like listsPanelOpen above.
const viewingDate = inject<Ref<string | null>>('viewingDate')!

const displayedTodos = computed(() => {
  if (!viewingDate.value) return defaultCurrentTodos.value
  return [...store.todosForFocusDate(viewingDate.value)].sort((a, b) => {
    const rankDiff = rank(a) - rank(b)
    if (rankDiff !== 0) return rankDiff
    return a.createdAt.localeCompare(b.createdAt)
  })
})

// Only today's own Date List (if viewing one) behaves like real Current —
// any other day is still in the future, so Done/Done-for-today stay
// locked (see TodoCard.vue's previewLocked) until it actually arrives.
const viewingLockedDate = computed(() => !!viewingDate.value && viewingDate.value !== todayStr())

const viewingDateLabel = computed(() => viewingDate.value === todayStr() ? 'today' : viewingDate.value)

function backToDefault() {
  viewingDate.value = null
}

// Same pattern as Calendar.vue's own planThisDay() — points the Focus-Date-
// Pille at this list's date and jumps to Overview, ready to swipe/assign
// todos onto it without a separate date-picker step. Only offered while
// actually viewing a Date List (not the default Current pool, which has
// its own add-todo input right at the top of the app already).
function planInOverview() {
  if (!viewingDate.value) return
  themeStore.setSelectedFocusDate(viewingDate.value)
  router.push('/all')
}

function onListSelected(dateStr: string | null) {
  viewingDate.value = dateStr
  listsPanelOpen.value = false
}

const fontMap = computed(() => assignFonts(displayedTodos.value.map(t => t.id)))
const siblingIds = computed(() => displayedTodos.value.map(t => t.id))

useListFlip(() => siblingIds.value, '.todo-wrap')

// Mirrors AllTodos.vue's sendToCurrent, `obvious` included — a card leaving
// this list otherwise just vanishes with no explanation. Toast rises from
// the card's own position, skipped for a direct CircleMinus click. Current
// and a Date List are independent (see stores/todos.ts), so which one this
// affects depends on which one is actually being viewed. Named removeCard,
// not removeFromCurrent, to not collide with the store action of that name
// this calls in the default (non-Date-List) branch.
//
// Branches on viewingDate, not viewingLockedDate (same as doneForToday
// below) — displayedTodos itself is driven by todosForFocusDate whenever
// any Date List is being viewed, today's included, so removing a card from
// *that* list has to unassign the focus date regardless of whether today
// counts as "locked". Using viewingLockedDate here used to leave today's
// own Date List calling plain removeFromCurrent instead — which only
// flips inCurrent, a flag todosForFocusDate never even looks at, so the
// card just stayed put.
function removeCard(id: string, obvious?: boolean) {
  if (!obvious) spawnRemovedFromCurrentToast(id)
  if (viewingDate.value) store.unassignFocusDate(id, viewingDate.value)
  else store.removeFromCurrent(id)
}

// Current and a Date List are independent lists (see stores/todos.ts) — a
// card's "done for today" here has to affect whichever one is actually
// being viewed, not always Current's own inCurrent-based version.
function doneForToday(id: string) {
  if (viewingDate.value) store.doneForTodayOnDate(id, viewingDate.value)
  else store.doneForToday(id)
}

// ── Checks ──
// Below the todo list, no divider — see CLAUDE.md's Checks section for the
// full design rationale (background reminders, lower weight than a Todo).

// A Date List preview is a full preview of that day, Checks included, not
// just Todos — see CLAUDE.md's Date Lists section. checkDisplayDate powers
// both which checks show (checksDueOn) and which date isCompletedOn reads
// off; viewingLockedDate (already used for Todos' Done/Done-for-today)
// reused as-is to lock ticking a Check on a day that hasn't arrived yet.
const checkDisplayDate = computed(() => viewingDate.value ?? todayStr())
const displayedChecks = computed(() => viewingDate.value ? checksStore.checksDueOn(viewingDate.value) : checksStore.todayChecks)

function onToggleCheck(check: CheckItem, event: MouseEvent) {
  if (viewingLockedDate.value) return
  const becomingChecked = !checksStore.isCompletedOn(check, checkDisplayDate.value)
  checksStore.toggleCompletion(check.id, checkDisplayDate.value)
  if (becomingChecked && themeStore.celebrationsEnabled) {
    burstCheckbox(event.currentTarget as HTMLElement)
  }
}

// Which of the two icon buttons is currently hovered — drives the single
// shared label underneath them (see checks-action-label in the template).
const checksHover = ref<'add' | 'edit' | null>(null)

const checkModalState = ref<'add' | CheckItem | null>(null)

function openAddCheck() {
  checkModalState.value = 'add'
}

function openEditCheck(check: CheckItem) {
  checkModalState.value = check
}

function closeCheckModal() {
  checkModalState.value = null
}

// Browsing/editing every Check, not just today's due ones — the only
// place a not-currently-due check (e.g. weekly, not due this week) can be
// reached to edit or delete at all.
const showAllChecks = ref(false)

function openAllChecks() {
  showAllChecks.value = true
}

function closeAllChecks() {
  showAllChecks.value = false
}

// Swaps the browse-list for CheckModal on the same check — one overlay on
// screen at a time, same as everywhere else in the app.
function editFromAllChecks(check: CheckItem) {
  showAllChecks.value = false
  checkModalState.value = check
}
</script>

<template>
  <div class="current-view" :class="{ 'is-empty': !displayedTodos.length }">
    <div v-if="viewingDate" class="viewing-date-banner">
      <button type="button" class="viewing-date-back" @click="backToDefault">
        <ChevronLeft :size="16" /> default
      </button>
      <span class="viewing-date-label">{{ viewingDateLabel }}</span>
    </div>

    <div v-if="themeStore.subsEnabled && displayedTodos.length" class="expand-subs-row">
      <span class="expand-subs-label">subs</span>
      <button
        type="button"
        class="switch"
        role="switch"
        :aria-checked="themeStore.expandCurrentSubs === 'full'"
        :title="`subs: ${themeStore.expandCurrentSubs}`"
        :class="{ half: themeStore.expandCurrentSubs === 'half', on: themeStore.expandCurrentSubs === 'full' }"
        @click="themeStore.toggleExpandCurrentSubs()"
      >
        <span class="switch-knob" />
      </button>
    </div>

    <div v-if="displayedTodos.length" class="todo-wrap">
      <TodoCard
        v-for="(todo, index) in displayedTodos"
        :key="todo.id"
        :data-flip-id="todo.id"
        :todo="todo"
        :font="fontMap.get(todo.id)"
        :sibling-ids="siblingIds"
        :index="index"
        :force-expand-subs="themeStore.expandCurrentSubs"
        :preview-locked="viewingLockedDate"
        mode="current"
        @remove-from-current="removeCard"
        @complete="store.completeTodo($event)"
        @done-for-today="doneForToday"
        @delete="store.deleteTodo($event)"
      />
    </div>
    <p v-else class="empty">{{ viewingDate ? 'Nothing planned for this day.' : 'Nothing in current right now.' }}</p>

    <div v-if="viewingDate && themeStore.dateListsEnabled" class="plan-in-overview-row">
      <IconLabelButton
        :icon="Plus"
        label="add todos"
        title="Add todos to this list in Overview"
        @click="planInOverview"
      />
    </div>

    <div v-if="themeStore.checksEnabled" class="checks-section">
      <div class="checks-header">
        <div class="checks-icons">
          <button
            type="button"
            class="icon-circle-btn"
            title="Add check"
            @click="openAddCheck"
            @mouseenter="checksHover = 'add'"
            @mouseleave="checksHover = null"
          >
            <Plus :size="10" />
          </button>
          <button
            v-if="checksStore.activeChecks.length"
            type="button"
            class="icon-circle-btn"
            title="Edit checks"
            @click="openAllChecks"
            @mouseenter="checksHover = 'edit'"
            @mouseleave="checksHover = null"
          >
            <Pencil :size="10" />
          </button>
        </div>
        <span class="icon-action-label" :class="{ visible: checksHover }">{{ checksHover === 'edit' ? 'edit checks' : 'add check' }}</span>
      </div>
      <div v-if="displayedChecks.length" class="check-row">
        <button
          v-for="check in displayedChecks"
          :key="check.id"
          type="button"
          class="check-pill"
          :class="{ done: checksStore.isCompletedOn(check, checkDisplayDate) }"
          @click="openEditCheck(check)"
        >
          <span
            class="check-box"
            :class="{ checked: checksStore.isCompletedOn(check, checkDisplayDate), locked: viewingLockedDate }"
            :title="viewingLockedDate ? 'This day hasn\'t arrived yet' : undefined"
            @click.stop="onToggleCheck(check, $event)"
          >
            <Check v-if="checksStore.isCompletedOn(check, checkDisplayDate)" :size="10" />
          </span>
          <span class="check-label">{{ check.title }}</span>
        </button>
      </div>
    </div>
  </div>

  <CheckModal
    v-if="checkModalState === 'add'"
    @close="closeCheckModal"
  />
  <CheckModal
    v-else-if="checkModalState"
    :editing="checkModalState"
    @close="closeCheckModal"
  />

  <ListsPanel
    v-if="listsPanelOpen"
    :viewing-date="viewingDate"
    @select="onListSelected"
    @close="listsPanelOpen = false"
  />

  <AllChecksModal
    v-if="showAllChecks"
    @close="closeAllChecks"
    @edit="editFromAllChecks"
  />
</template>

<style scoped>
.current-view {
  width: 100%;
  max-width: 640px;
}

.todo-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.viewing-date-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.viewing-date-back {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--ink);
  opacity: 0.6;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-mono, monospace);
  cursor: pointer;
  padding: 0;
  transition: opacity 0.1s;
}

@media (hover: hover) {
  .viewing-date-back:hover {
    opacity: 1;
  }
}

.viewing-date-label {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-dark);
  font-family: var(--font-mono, monospace);
}

/* Desktop (unqualified — see base.css's breakpoint convention): pinned
   directly under the Settings button instead of living inline atop the
   todo list. Same offsets .settings-head itself resolves to — #app's own
   36px padding + its 16px head padding = 52px from the viewport's right
   edge — and content-inner's own top offset (36px app padding + 88px
   header row + 36px content-inner padding = 160px) for the vertical spot
   this sat at before it left the document flow. Tablet/mobile revert to
   the original inline row below — Settings doesn't have its own column
   there to sit under. */
.expand-subs-row {
  position: fixed;
  top: 160px;
  right: 52px;
  z-index: 25;
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Tablet/mobile get their own version instead, replacing the inert tag
   icon in App.vue's main-head (see App.vue's mobile-subs-toggle) — this
   inline row would otherwise show up a second time alongside it. */
@media (max-width: 1024px) {
  .expand-subs-row {
    display: none;
  }
}

.expand-subs-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  font-family: var(--font-mono, monospace);
  opacity: 0.7;
}

/* Same switch look as Settings.vue's daily-shuffle toggle — duplicated
   here (scoped styles, no shared component) rather than extracted, same
   footprint as the rest of this app's small styling duplications. */
.switch {
  position: relative;
  flex-shrink: 0;
  width: 36px;
  height: 21px;
  padding: 0;
  border: 2px solid var(--ink);
  border-radius: var(--radius);
  background: transparent;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.switch:hover {
  border-color: var(--ink-dark);
}

.switch.on {
  background: var(--ink);
}

.switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 13px;
  height: 13px;
  border-radius: max(0px, calc(var(--radius) - 2px));
  background: var(--ink);
  opacity: 0.35;
  transition: transform 0.15s, background 0.15s, opacity 0.15s;
}

/* Middle position of the three-state cycle (off → half → full) — track
   stays unfilled like off, knob just moves halfway and darkens a notch to
   read as "in between" rather than fully on or off. */
.switch.half .switch-knob {
  opacity: 0.7;
  transform: translateX(7.5px);
}

.switch.on .switch-knob {
  background: var(--bg);
  opacity: 1;
  transform: translateX(15px);
}

.empty {
  color: var(--ink);
  font-size: 18px;
  font-weight: bold;
  font-family: var(--font-playful, sans-serif);
  text-align: center;
  margin-top: 24px;
}

/* Sits right under the viewed Date List's own todos (or its "Nothing
   planned" empty state) — a quick way into Overview with this list already
   preset as the plan-ahead target. Left-aligned flush with the todo cards
   above it (.todo-wrap's own align-items:flex-start), not centered. */
.plan-in-overview-row {
  display: flex;
  justify-content: flex-start;
  margin-top: 24px;
}

/* Generous space instead of a visual divider — Checks read as lower-
   weight background items, not a second list that needs separating from
   the todos above it. */
.checks-section {
  margin-top: 66px;
}

/* Icons stacked directly above their own shared label instead of side by
   side — see checks-action-label below. 24px below the whole cluster to
   today's own checks (up from the plain add-btn's old 14px), since it now
   reads as its own two-line unit rather than a single inline row. */
.checks-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-left: 5px;
  margin-bottom: 24px;
}

.checks-icons {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Icon circle style (.icon-circle-btn) and the fade-in label below it
   (.icon-action-label) both live in base.css, shared with Calendar.vue's
   day-detail Add/Edit icons — same resting/hover opacity as .check-pill's
   checkboxes below, one consistent "dim, brightens on hover" treatment
   across the whole Checks UI. Which text shows ("add check" vs. "edit
   checks") is decided here via checksHover in the script. */

.check-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 20px;
  /* Lines Checks' left edge up with where a todo card's own drop shadow
     starts (box-shadow: 5px 5px 0 ..., see TodoCard.vue) rather than the
     card's own flush-left edge. */
  margin-left: 5px;
}

.check-pill {
  display: flex;
  /* flex-start, not center: a title long enough to wrap onto a second
     line (see .check-label) would otherwise float the checkbox in the
     vertical middle of both lines instead of level with the first one. */
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  opacity: 0.55;
  transition: opacity 0.1s;
}

@media (hover: hover) {
  .check-pill:hover {
    opacity: 0.9;
  }
}

.check-pill.done {
  opacity: 0.3;
}

.check-box {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 2px solid var(--ink);
  /* var(--radius) is 6px in rounded mode — on a box this small that's
     effectively half its size, i.e. a circle, not a rounded corner. Capped
     at 3px so it still follows the rounded/square setting (0px stays 0px)
     without going further than a corner. */
  border-radius: min(var(--radius), 3px);
  box-shadow: 2px 2px 0 var(--priority-shadow);
  color: var(--bg);
  cursor: pointer;
}

.check-box.checked {
  background: var(--ink);
}

/* Same "not due yet" lock as TodoCard's Done/Done-for-today row for a
   future Date List preview — pointer-events:none instead of a disabled
   attribute (this is a span, not a button), so the click falls through to
   the surrounding .check-pill and still opens the edit modal. */
.check-box.locked {
  cursor: default;
  pointer-events: none;
}

.check-label {
  /* No truncation — Checks stack one per line now (no fixed column width
     to fit), so the full CHECK_TITLE_MAX_LENGTH (60 chars) just gets to
     wrap onto a second line instead of being cut off. word-break matches
     TodoCard's own title rule — without it, a title long/dense enough to
     not hit a natural space before running out of row width (easy to hit
     on a narrow phone screen at the full character limit) just overflows
     straight past the screen edge instead of wrapping. */
  min-width: 0;
  word-break: break-word;
  color: var(--ink);
  font-size: 16px;
  font-weight: 600;
  font-family: var(--font-mono, monospace);
}

/* Same fix as AllTodos.vue's list-view: content-inner centers this
   640px-capped block, so its left edge drifts depending on how much wider
   than 640px the row is at a given tablet width. Pin it to the left,
   offset to match main-head's own left padding (20px) against
   content-inner's (6px). Doesn't apply to the empty state — there's no
   list to align against, so it stays centered like the calendar's own
   empty-day placeholder. */
@media (min-width: 701px) and (max-width: 1024px) {
  .current-view:not(.is-empty) {
    align-self: flex-start;
    margin-left: 14px;
  }
}
</style>

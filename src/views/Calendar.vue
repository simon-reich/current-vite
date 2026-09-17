<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, inject } from 'vue'
import type { Ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { motion } from 'motion-v'
import { Plus, Pencil } from '@lucide/vue'
import { useTodosStore, PRIORITY_TAG_ID, type Todo, type Sub } from '../stores/todos'
import { useChecksStore } from '../stores/checks'
import { useThemeStore } from '../stores/theme'
import { useScrollTracking } from '../composables/useScrollTracking'
import { todayStr } from '../composables/useToday'
import ScrollDivider from '../components/ScrollDivider.vue'
import IconLabelButton from '../components/IconLabelButton.vue'

const store = useTodosStore()
const router = useRouter()
// Provided by App.vue, same ref Current.vue's own Date-List nav reads/writes
// (see App.vue's viewingDate) — the Edit button below sets it directly so
// Current opens straight into this day's list instead of its default pool.
const viewingDate = inject<Ref<string | null>>('viewingDate')!
const checksStore = useChecksStore()
const themeStore = useThemeStore()
const calendarRef = ref<any>(null)
const viewRef = ref<HTMLElement | null>(null)
const dayDetailScrollRef = ref<HTMLElement | null>(null)
const dayDetailRef = ref<HTMLElement | null>(null)
const dayDetailBottomSpacerRef = ref<HTMLElement | null>(null)
const {
  scrolled: dayDetailScrolled,
  scrolledToBottom: dayDetailScrolledToBottom,
  spacerHeight: dayDetailSpacerHeight,
  check: checkDayDetailScrollState,
} = useScrollTracking({ scrollEl: dayDetailScrollRef, resizeTarget: dayDetailRef, spacerEl: dayDetailBottomSpacerRef, targetGap: 40 })

function onDayDetailScroll() {
  checkDayDetailScrollState()
}

const selectedDate = ref<string>(todayStr())

onMounted(async () => {
  await nextTick()
  calendarRef.value?.move(new Date())
  viewRef.value?.focus()
})

onBeforeRouteLeave(() => {
  selectedDate.value = todayStr()
})

function shiftDate(days: number) {
  const d = new Date(selectedDate.value + 'T12:00:00')
  d.setDate(d.getDate() + days)
  selectedDate.value = d.toISOString().slice(0, 10)
  calendarRef.value?.move(d)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft')  { e.preventDefault(); shiftDate(-1) }
  if (e.key === 'ArrowRight') { e.preventDefault(); shiftDate(1) }
  if (e.key === 'ArrowUp')    { e.preventDefault(); shiftDate(-7) }
  if (e.key === 'ArrowDown')  { e.preventDefault(); shiftDate(7) }
}

const activeDates = computed(() => {
  const days = new Set<string>()
  store.todos.forEach(t => {
    if (t.completedAt) days.add(t.completedAt.slice(0, 10))
    t.workLog.forEach(ts => days.add(ts.slice(0, 10)))
  })
  return [...days].map(d => new Date(d + 'T12:00:00'))
})

// Its own dot (see attributes below), kept visually distinct from Todo
// activity — a day can carry both at once, and they track different
// things (a Check ticked vs. a Todo done/worked on).
const checksActiveDates = computed(() => {
  if (!themeStore.checksEnabled) return []
  const days = new Set<string>()
  checksStore.checks.forEach(c => c.completedDates.forEach(d => days.add(d)))
  return [...days].map(d => new Date(d + 'T12:00:00'))
})

// Future days already carrying a planned Date List (see stores/todos.ts's
// futureFocusDates) — its own dot type, dimmer than the solid "done/
// worked" one above since nothing has actually happened on these days yet.
const plannedActiveDates = computed(() => {
  if (!themeStore.dateListsEnabled) return []
  return store.futureFocusDates.map(d => new Date(d + 'T12:00:00'))
})

const attributes = computed(() => {
  const attrs: object[] = []
  if (selectedDate.value) {
    attrs.push({
      key: 'selected',
      highlight: {
        style: {
          backgroundColor: 'transparent',
          border: '2px solid var(--ink)',
          borderRadius: '4px',
          width: '28px',
          height: '20px',
        },
      },
      dates: new Date(selectedDate.value + 'T12:00:00'),
    })
  }
  attrs.push({
    key: 'today',
    highlight: {
      style: {
        backgroundColor: 'var(--ink-dark)',
        borderRadius: '4px',
        width: '28px',
        height: '20px',
      },
      contentStyle: {
        color: 'var(--bg) !important',
        fontSize: '12px',
      },
    },
    dates: new Date(),
  })
  if (activeDates.value.length) {
    attrs.push({ key: 'active', dot: { style: { backgroundColor: 'var(--ink)' } }, dates: activeDates.value })
  }
  if (checksActiveDates.value.length) {
    attrs.push({ key: 'checksActive', dot: { style: { backgroundColor: 'var(--ink)', opacity: 0.4 } }, dates: checksActiveDates.value })
  }
  if (plannedActiveDates.value.length) {
    attrs.push({ key: 'plannedActive', dot: { style: { backgroundColor: 'var(--ink)', opacity: 0.2 } }, dates: plannedActiveDates.value })
  }
  return attrs
})

function onDayClick(day: { id: string }) {
  selectedDate.value = day.id
}

watch(selectedDate, async () => {
  if (dayDetailScrollRef.value) dayDetailScrollRef.value.scrollTop = 0
  await nextTick()
  checkDayDetailScrollState()
})

const selectedDateLabel = computed(() => {
  if (!selectedDate.value) return ''
  return new Date(selectedDate.value + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
})

const doneOnDay = computed(() => selectedDate.value ? store.completedOn(selectedDate.value) : [])
const workedOnDay = computed(() => selectedDate.value ? store.workedOn(selectedDate.value) : [])
// Own section at the end of the day's list (see the template) rather than
// mixed into doneOnDay/workedOnDay — Checks aren't Todos, ticking one is a
// different kind of event than completing/working a Todo.
const checksOnDay = computed(() => selectedDate.value && themeStore.checksEnabled ? checksStore.completedOn(selectedDate.value) : [])
// Subs completed this day, per parent todo — a todo can show up here even
// on a day it was never itself Done/Done-for-today (see dayEntries below),
// which is exactly why subs-only progress still lands on the calendar.
const subsOnDay = computed(() => selectedDate.value && themeStore.subsEnabled ? store.subsCompletedOn(selectedDate.value) : [])

// Todos actually planned onto the selected day's Date List (see
// stores/todos.ts's focusDates) — deliberately excludes Date-todos
// (loopInterval set): todosForFocusDate live-computes those as "due that
// day" off their recurrence rule, which is true on literally every matching
// day including ones long past, so they'd otherwise sit here forever
// mislabeled as "planned" instead of the automatic recurrence they actually
// are. Meaningful for today or any future day, shown in its own section
// since nothing here has actually happened yet (unlike dayEntries/
// checksOnDay, which are all history).
const plannedOnDay = computed(() => {
  if (!selectedDate.value || !themeStore.dateListsEnabled) return []
  return store.todosForFocusDate(selectedDate.value).filter(t => !t.loopInterval)
})

// Jumps to Overview with the widget already pointed at this day, ready to
// assign todos to it without a separate date-picker step — see
// FocusDateWidget.vue/stores/theme.ts's selectedFocusDate.
function planThisDay() {
  if (!selectedDate.value) return
  themeStore.setSelectedFocusDate(selectedDate.value)
  router.push('/all')
}

// Jumps to Current with this day's Date List already open (App.vue's own
// viewingDate, same ref its desktop sidebar Date-List nav uses) — a quick
// way to review/edit what's already planned without hunting for the date
// again over there.
function editThisDayList() {
  if (!selectedDate.value) return
  viewingDate.value = selectedDate.value
  router.push('/current')
}

const hasActivity = computed(() => dayEntries.value.length > 0 || checksOnDay.value.length > 0)

// Today can show both the planned-for-today list and today's own completed/
// worked history at once — history reads more relevant there (what did I
// actually get done today) so it goes first, plan second. Any other day
// only ever has one of the two in practice, but keeps plan-first regardless
// (matches every other day's reading order: what's coming, not a review).
const isSelectedToday = computed(() => selectedDate.value === todayStr())

// The plan section (empty state + Add/Edit) only makes sense for today or a
// future day — a past day is done, "no activities planned for this day yet"
// plus an Add button that plans into the past is nonsensical there.
const isPastDate = computed(() => !!selectedDate.value && selectedDate.value < todayStr())

// Each entry keeps its own done/worked "kind" (for the ✓✓ vs ✓ icon) even
// though the day's list is no longer *grouped* by that — see dayEntries
// below. What was actually finished vs. just touched today is still worth
// showing per item, it's just not the more interesting question for a
// retrospective glance at the day. A todo that only had subs ticked today
// (never itself Done/Done-for-today) still counts as "worked" here — Done-
// for-today is about closing a todo back into the pool for later, not the
// only way of showing you touched it; ticking subs across several days is
// the same kind of progress and should read the same way in the calendar.
interface DayEntry { todo: Todo; kind: 'done' | 'worked'; subs: Sub[] }

// Merges doneOnDay/workedOnDay/subsOnDay into one entry per todo — a todo
// touched in more than one way the same day (e.g. Done *and* some subs
// ticked first) gets a single row with both its kind and its subs, instead
// of appearing twice.
const dayEntries = computed<DayEntry[]>(() => {
  const map = new Map<string, DayEntry>()
  doneOnDay.value.forEach(todo => map.set(todo.id, { todo, kind: 'done', subs: [] }))
  workedOnDay.value.forEach(todo => {
    if (!map.has(todo.id)) map.set(todo.id, { todo, kind: 'worked', subs: [] })
  })
  subsOnDay.value.forEach(({ todo, subs }) => {
    const existing = map.get(todo.id)
    if (existing) existing.subs = subs
    else map.set(todo.id, { todo, kind: 'worked', subs })
  })
  return [...map.values()]
})

// Priority vs. everything else, not done vs. worked-on — priority is
// already the app's one first-class "this mattered" signal everywhere
// else (card fill, its own filter/sort rank in Current), so grouping by it
// here answers "did I get to the important stuff" instead of the more
// bookkeeping-flavored "did I finish it or just poke at it".
const priorityEntries = computed(() => dayEntries.value.filter(e => e.todo.tags.includes(PRIORITY_TAG_ID)))
const otherEntries = computed(() => dayEntries.value.filter(e => !e.todo.tags.includes(PRIORITY_TAG_ID)))
</script>

<template>
  <div ref="viewRef" class="calendar-view" tabindex="0" @keydown="onKeydown">
    <motion.div
      class="calendar-inner"
      :initial="{ opacity: 0, scale: 0.96 }"
      :animate="{ opacity: 1, scale: 1 }"
      :transition="{ type: 'spring', stiffness: 380, damping: 26, mass: 0.8 }"
    >
      <VCalendar
        ref="calendarRef"
        class="cal"
        :attributes="attributes"
        expanded
        locale="en"
        :first-day-of-week="2"
        @dayclick="onDayClick"
      />
    </motion.div>

    <ScrollDivider class="day-scroll-divider" :visible="dayDetailScrolled" />

    <div ref="dayDetailScrollRef" class="day-detail-scroll" @scroll="onDayDetailScroll">
      <div ref="dayDetailRef" class="day-detail calendar-inner">
        <transition
          name="unfold"
          mode="out-in"
          appear
          appear-active-class="unfold-appear-active"
          appear-from-class="unfold-appear-from"
        >
          <div :key="selectedDate" class="day-detail-content">
            <div class="day-label-row">
              <p class="day-label">{{ selectedDateLabel }}</p>
            </div>

            <div
              v-if="themeStore.dateListsEnabled && !isPastDate"
              class="day-plan-block"
              :style="{ order: isSelectedToday ? 2 : 1 }"
            >
              <div v-if="plannedOnDay.length" class="day-items planned-items">
                <p class="planned-items-label">planned</p>
                <div v-for="todo in plannedOnDay" :key="todo.id" class="day-item day-item--planned">
                  <span class="day-item-bullet">–</span>{{ todo.title }}
                </div>
              </div>
              <p v-else class="day-plan-empty">no activities planned for this day yet</p>

              <div class="day-plan-actions">
                <IconLabelButton
                  compact
                  :circle-size="26"
                  :icon-size="11"
                  :icon="Plus"
                  label="add"
                  title="Plan this day in Overview"
                  @click="planThisDay"
                />
                <IconLabelButton
                  v-if="plannedOnDay.length"
                  compact
                  :circle-size="26"
                  :icon-size="11"
                  :icon="Pencil"
                  label="edit"
                  title="Edit this day's list in Current"
                  @click="editThisDayList"
                />
              </div>
            </div>

            <div
              v-if="hasActivity || !themeStore.dateListsEnabled || isPastDate"
              class="day-history-block"
              :style="{ order: isSelectedToday ? 1 : 2 }"
            >
              <div v-if="hasActivity" class="day-items">
                <div v-for="entry in priorityEntries" :key="entry.todo.id" class="day-entry">
                  <div class="day-item">
                    <span :class="['icon', entry.kind === 'done' ? 'icon--done' : 'icon--worked']">{{ entry.kind === 'done' ? '✓✓' : '✓' }}</span>{{ entry.todo.title }}
                  </div>
                  <div v-if="entry.subs.length" class="day-subs">
                    <div v-for="sub in entry.subs" :key="sub.id" class="day-sub-item">– {{ sub.title }}</div>
                  </div>
                </div>
                <div v-if="priorityEntries.length && otherEntries.length" class="day-divider" />
                <div v-for="entry in otherEntries" :key="entry.todo.id" class="day-entry">
                  <div class="day-item">
                    <span :class="['icon', entry.kind === 'done' ? 'icon--done' : 'icon--worked']">{{ entry.kind === 'done' ? '✓✓' : '✓' }}</span>{{ entry.todo.title }}
                  </div>
                  <div v-if="entry.subs.length" class="day-subs">
                    <div v-for="sub in entry.subs" :key="sub.id" class="day-sub-item">– {{ sub.title }}</div>
                  </div>
                </div>
                <div v-if="(priorityEntries.length || otherEntries.length) && checksOnDay.length" class="day-divider" />
                <div v-for="check in checksOnDay" :key="check.id" class="day-item day-item--check">
                  <span class="icon icon--check"><span class="icon-dot" /></span>{{ checksStore.titleOn(check, selectedDate) }}
                </div>
              </div>

              <p v-else class="no-activity">No activity for this day.</p>
            </div>
          </div>
        </transition>

        <div ref="dayDetailBottomSpacerRef" class="bottom-breathing-spacer" :style="{ height: dayDetailSpacerHeight + 'px' }" />
      </div>
    </div>

    <ScrollDivider class="day-scroll-divider-bottom" :visible="!dayDetailScrolledToBottom" />
  </div>
</template>

<style scoped>
.calendar-view {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  outline: none;
}

/* Caps the calendar grid and the day's entries at the same reading width,
   while the divider lines (siblings, outside this wrapper) span the full
   .calendar-view width like every other divider in the app. */
.calendar-inner {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
}

.cal {
  width: 100%;
}

.cal :deep(.vc-container) {
  background: var(--bg) !important;
  border: none !important;
  border-radius: var(--radius);
}

.cal :deep(.vc-header),
.cal :deep(.vc-weeks),
.cal :deep(.vc-week),
.cal :deep(.vc-day) {
  background: var(--bg) !important;
  border: none !important;
}

.cal :deep(.vc-day-content) {
  color: var(--ink) !important;
  font-size: 20px !important;
}

.cal :deep(.vc-day-content:hover) {
  background: rgba(135, 128, 128, 0.15) !important;
}

.cal :deep(.vc-title) {
  color: var(--ink-dark) !important;
  font-size: 26px !important;
  font-weight: 700 !important;
}

.cal :deep(.vc-weekday) {
  color: var(--ink) !important;
  font-size: 18px !important;
}

.cal :deep(.vc-arrow) {
  width: 36px !important;
  height: 36px !important;
}

.cal :deep(.vc-arrow svg) {
  width: 22px !important;
  height: 22px !important;
}

.cal :deep(.vc-day-content) {
  width: 36px !important;
  height: 36px !important;
  font-size: 20px !important;
}

/* Narrower than the calendar grid above it (which keeps its own 640px cap
   via .calendar-inner) — the day's entries read better in a tighter,
   centered column instead of stretching out to match the grid's width. */
.day-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
}

.day-detail-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  width: 100%;
}

.day-label {
  font-size: 24px;
  font-weight: 600;
  color: var(--ink-dark);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-family: var(--font-playful, sans-serif);
}

.day-label-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Same look as .no-activity below — it replaces that message whenever Date
   Lists are on, so it should read the same, not like a smaller aside. */
.day-plan-empty {
  font-size: 18px;
  font-weight: bold;
  color: var(--ink);
  font-family: var(--font-playful, sans-serif);
  text-align: center;
}

/* Sits centered under the planned list (or its empty state) — .compact
   IconLabelButtons keep their hover-label from pushing the other button
   sideways (see IconLabelButton.vue), so they can sit this close together. */
.day-plan-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}

.planned-items-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
  opacity: 0.5;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-family: var(--font-mono, monospace);
}

.day-item--planned {
  opacity: 0.7;
}

/* Own flex item (like .icon above) rather than inline text — a wrapped
   second line then lines up under the title, not under the dash. */
.day-item-bullet {
  flex-shrink: 0;
}

.day-items {
  display: flex;
  flex-direction: column;
  align-self: flex-start;
  width: 100%;
  gap: 6px;
}

.day-entry {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.day-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 20px;
  font-weight: bold;
  color: var(--ink);
  font-family: var(--font-playful, sans-serif);
}

/* Completed subs for that same day, nested under their parent todo — same
   lower-weight opacity treatment as Checks (.day-item--check) rather than
   a new color, matching the app's four-value color rule. Indented past
   the ✓✓/✓ icon column (1.4em + its 10px gap) so it reads as belonging to
   the todo above it. */
.day-subs {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: calc(1.4em + 10px);
  opacity: 0.65;
}

.day-sub-item {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  font-family: var(--font-playful, sans-serif);
  word-break: break-word;
}

.icon {
  font-size: 13px;
  line-height: 27px;
  margin-top: 4px;
  flex-shrink: 0;
  letter-spacing: -1px;
  width: 1.4em;
  text-align: right;
}

.icon--done {
  color: var(--ink);
}

.icon--worked {
  color: var(--ink);
}

/* Checks read as lower-weight than Todos everywhere else in the app (see
   Current's own check-row) — same treatment here via opacity rather than a
   separate color, which the app's four-value color rule doesn't allow. */
.day-item--check {
  opacity: 0.65;
}

.icon--check {
  /* .day-item is align-items:flex-start, so its children top-align by
     default — align-self:stretch instead makes this icon's own box match
     the row's full height (i.e. the text's line height), and
     align-items:center below then centers the dot within *that*, rather
     than the fixed line-height/margin-top nudge the ✓✓/✓ text glyphs
     above use (tuned for their own font-size/line-height, not this). */
  align-self: stretch;
  margin-top: 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  letter-spacing: normal;
  color: var(--ink);
}

.icon-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.day-divider {
  height: 1px;
  border-top: 2px dashed var(--ink);
  opacity: 1;
  margin: 2px 0;
}

.no-activity {
  font-size: 18px;
  font-weight: bold;
  color: var(--ink);
  font-family: var(--font-playful, sans-serif);
}

.unfold-enter-active,
.unfold-leave-active { transition: opacity 0.09s; }
.unfold-enter-from,
.unfold-leave-to { opacity: 0; }

/* Only for the very first mount (switching into the Calendar view) — timed
   to match the calendar grid's own entrance spring (see .calendar-inner)
   so both arrive together, instead of the day's entry (day-switch fade
   above) finishing far ahead of the grid. */
.unfold-appear-active { transition: opacity 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1); }
.unfold-appear-from { opacity: 0; transform: translateY(8px); }

/* Pin the calendar in place, scroll the day's entries underneath it
   instead of scrolling the whole page — the calendar grid otherwise
   travels out of view along with everything else. Applies on any viewport
   width; only the bottom divider's clearance differs on mobile (fixed
   bottom nav) vs. desktop (none). */
.calendar-view {
  height: 100%;
  gap: 0;
}

.cal {
  flex-shrink: 0;
}

/* Divider lines only make visual sense on mobile — desktop hides both. */
.day-scroll-divider,
.day-scroll-divider-bottom {
  display: none;
}

.day-detail-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 20px 0 0;
  scrollbar-width: none;
}

.day-detail-scroll::-webkit-scrollbar {
  display: none;
}

@media (max-width: 700px) {
  .day-scroll-divider {
    display: block;
    flex-shrink: 0;
  }

  .day-scroll-divider-bottom {
    display: block;
    position: fixed;
    bottom: 60px;
    left: 0;
    right: 0;
    pointer-events: none;
  }

  /* Even narrower on phones than the general 420px cap above. */
  .day-detail {
    max-width: 320px;
  }
}
</style>

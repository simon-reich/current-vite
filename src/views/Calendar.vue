<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch, inject } from 'vue'
import type { Ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { motion } from 'motion-v'
import { Plus, Pencil } from '@lucide/vue'
import { useTodosStore, PRIORITY_TAG_ID, type Todo, type Sub } from '../stores/todos'
import { useChecksStore } from '../stores/checks'
import { useThemeStore } from '../stores/theme'
import { useScrollTracking } from '../composables/useScrollTracking'
import { todayStr, addDaysStr, localDayOf, MONTH_LABELS } from '../composables/useToday'
import { arrowKeyDayDelta } from '../composables/useCalendarKeys'
import ScrollDivider from '../components/ScrollDivider.vue'
import UndoDoneButton from '../components/UndoDoneButton.vue'
import CalendarModeToggle from '../components/CalendarModeToggle.vue'
import CircleCheckIcon from '../components/icons/CircleCheckIcon.vue'

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
  updateLogMonth()
}

// The log's "where am I" marker: month and year of the topmost group
// still in view (.log-month) — a quick reference point while scrolling
// back, since the groups themselves only name the day. Only once the log
// is actually scrolled (same moment the divider shows), not at the very
// top where it'd just repeat the obvious. Read off the DOM on scroll
// (each group carries its date), nothing to keep in sync.
const logMonth = ref('')
const showLogMonth = computed(() => viewMode.value === 'log' && dayDetailScrolled.value && !!logMonth.value)
function updateLogMonth() {
  const root = dayDetailScrollRef.value
  if (viewMode.value !== 'log' || !root) { logMonth.value = ''; return }
  const top = root.getBoundingClientRect().top
  const group = [...root.querySelectorAll<HTMLElement>('.log-group')].find(g => g.getBoundingClientRect().bottom > top + 1)
  const dateStr = group?.dataset.date
  if (!dateStr) { logMonth.value = ''; return }
  const [y, m] = dateStr.split('-').map(Number)
  logMonth.value = `${MONTH_LABELS[m - 1]} ${y}`
}

const selectedDate = ref<string>(todayStr())

// 'log' swaps the month grid + day detail for a flat list of every Done
// todo (see logGroups below) — the calendar's own "look back" area, so no
// separate route or nav entry. Owned by App.vue (see CalendarModeToggle.vue).
const viewMode = inject<Ref<'calendar' | 'log'>>('calendarViewMode')!

// The grid remounts when coming back from the log — reopen it on the
// month of the still-selected day instead of v-calendar's default.
watch(viewMode, async (mode) => {
  if (mode !== 'calendar') return
  await nextTick()
  calendarRef.value?.move(new Date(selectedDate.value + 'T12:00:00'))
})

onMounted(async () => {
  await nextTick()
  calendarRef.value?.move(new Date(todayStr() + 'T12:00:00'))
  viewRef.value?.focus()
})

onBeforeRouteLeave(() => {
  selectedDate.value = todayStr()
})

function shiftDate(days: number) {
  selectedDate.value = addDaysStr(selectedDate.value, days)
  calendarRef.value?.move(new Date(selectedDate.value + 'T12:00:00'))
}

function onKeydown(e: KeyboardEvent) {
  if (viewMode.value === 'log') return
  const delta = arrowKeyDayDelta(e.key)
  if (delta === null) return
  e.preventDefault()
  shiftDate(delta)
}

// One plain dot for any activity on a day — a Todo done/worked on or a
// Check ticked alike, no separate dot per kind.
const activeDates = computed(() => {
  const days = new Set<string>()
  store.todos.forEach(t => {
    if (t.completedAt) days.add(localDayOf(t.completedAt))
    t.workLog.forEach(ts => days.add(localDayOf(ts)))
  })
  if (themeStore.checksEnabled) {
    checksStore.checks.forEach(c => c.completedDates.forEach(d => days.add(d)))
  }
  return [...days].map(d => new Date(d + 'T12:00:00'))
})

// Future days already carrying a planned Date List (see stores/todos.ts's
// futureFocusDates) — its own dot type, outlined instead of the solid
// activity one above since nothing has actually happened on these days yet.
const plannedActiveDates = computed(() => {
  if (!themeStore.dateListsEnabled) return []
  return store.futureFocusDates.map(d => new Date(d + 'T12:00:00'))
})

// Today's fill and the selected day's outline follow Settings' corner
// style: 4px rounded (a touch tighter than --radius, these boxes are
// small), square corners in square mode.
const dayHighlightRadius = computed(() => themeStore.rounded ? '4px' : '0')

const attributes = computed(() => {
  const attrs: object[] = []
  if (selectedDate.value) {
    attrs.push({
      key: 'selected',
      highlight: {
        style: {
          backgroundColor: 'transparent',
          border: '2px solid var(--ink)',
          borderRadius: dayHighlightRadius.value,
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
        backgroundColor: 'var(--ink)',
        borderRadius: dayHighlightRadius.value,
        width: '28px',
        height: '20px',
      },
      contentStyle: {
        color: 'var(--bg) !important',
        fontSize: '12px',
      },
    },
    dates: new Date(todayStr() + 'T12:00:00'),
  })
  if (activeDates.value.length) {
    attrs.push({ key: 'active', dot: { style: { backgroundColor: 'var(--ink)' } }, dates: activeDates.value })
  }
  if (plannedActiveDates.value.length) {
    // Outlined instead of filled — same size as the activity dot
    // (border-box), nothing has happened on these days yet.
    attrs.push({ key: 'plannedActive', dot: { style: { backgroundColor: 'transparent', border: '1px solid var(--ink)', boxSizing: 'border-box' } }, dates: plannedActiveDates.value })
  }
  return attrs
})

function onDayClick(day: { id: string }) {
  selectedDate.value = day.id
}

watch([selectedDate, viewMode], async () => {
  if (dayDetailScrollRef.value) dayDetailScrollRef.value.scrollTop = 0
  await nextTick()
  checkDayDetailScrollState()
})

// "Saturday, October 3, 2026" — the day detail's own heading and each of
// the log's day groups.
function formatDayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

const selectedDateLabel = computed(() => selectedDate.value ? formatDayLabel(selectedDate.value) : '')

// The log view: every Done todo (store.completedTodos, newest first, deleted
// ones left out) grouped by its completion day — same day key completedOn
// uses, so a todo sits under exactly the day the calendar shows it on.
const logGroups = computed(() => {
  const groups: { dateStr: string; label: string; todos: Todo[] }[] = []
  for (const todo of store.completedTodos) {
    const dateStr = localDayOf(todo.completedAt!)
    const last = groups[groups.length - 1]
    if (last && last.dateStr === dateStr) last.todos.push(todo)
    else groups.push({ dateStr, label: formatDayLabel(dateStr), todos: [todo] })
  }
  return groups
})

// The log only shows the last LOG_WINDOW_DAYS days (today included) at
// first; scrolling past its end widens that window in LOG_WINDOW_DAYS
// steps on its own (see logSentinelRef below) — far enough to always
// reach the next day that actually has entries, so a load never turns up
// nothing. Display-only: nothing is persisted, and switching to the log
// again starts back at one window.
const LOG_WINDOW_DAYS = 30
const logWindows = ref(1)
// Groups that came in with the latest load — they domino in (see
// .log-group--new), the ones already there stay put.
const newLogDates = ref(new Set<string>())
watch(viewMode, (mode) => {
  if (mode !== 'log') return
  logWindows.value = 1
  newLogDates.value = new Set()
})

const logCutoff = computed(() => addDaysStr(todayStr(), 1 - LOG_WINDOW_DAYS * logWindows.value))
const visibleLogGroups = computed(() => logGroups.value.filter(g => g.dateStr >= logCutoff.value))
// Newest group still hidden (groups are newest first), if any.
const nextOlderLogGroup = computed(() => logGroups.value.find(g => g.dateStr < logCutoff.value))

function showOlderLog() {
  const next = nextOlderLogGroup.value
  if (!next) return
  const before = new Set(visibleLogGroups.value.map(g => g.dateStr))
  const today = new Date(todayStr() + 'T12:00:00')
  const daysBack = Math.round((today.getTime() - new Date(next.dateStr + 'T12:00:00').getTime()) / 86_400_000)
  logWindows.value = Math.ceil((daysBack + 1) / LOG_WINDOW_DAYS)
  newLogDates.value = new Set(visibleLogGroups.value.map(g => g.dateStr).filter(d => !before.has(d)))
}

// Domino order for a new group's label and entries: one running index
// across everything that came in with the load, so the rows tip in one
// after another top to bottom. Capped so a big load doesn't keep the last
// rows waiting for seconds.
const LOG_DOMINO_CAP = 14
const logDominoStart = computed(() => {
  const start = new Map<string, number>()
  let i = 0
  for (const g of visibleLogGroups.value) {
    if (!newLogDates.value.has(g.dateStr)) continue
    start.set(g.dateStr, i)
    i += g.todos.length + 1
  }
  return start
})
function logDomino(dateStr: string, k: number) {
  const start = logDominoStart.value.get(dateStr)
  return start === undefined ? undefined : { '--i': Math.min(start + k, LOG_DOMINO_CAP) }
}

// Endless log: the list ends in a bit of empty run-out (.log-more) you can
// scroll on into, past the last entry. Its far end carries an invisible
// marker — once that's in view, the log holds for a beat (so it reads as
// "reached the end, fetching more" rather than an unexplained stop) and
// then the next part dominoes in. Watched against the viewport (root
// null) rather than the scroll container, so it works whichever element
// actually scrolls on the current layout. Re-observed after every load:
// an observer only reports changes, so a marker that's still in view (a
// short log that doesn't fill the screen yet) would otherwise never fire
// again.
const LOG_LOAD_PAUSE_MS = 350
const logSentinelRef = ref<HTMLElement | null>(null)
const logLoading = ref(false)
let logLoadTimer: ReturnType<typeof setTimeout> | null = null
const logObserver = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver(entries => {
      if (logLoading.value || !entries.some(e => e.isIntersecting)) return
      logLoading.value = true
      logLoadTimer = setTimeout(() => {
        logLoading.value = false
        showOlderLog()
      }, LOG_LOAD_PAUSE_MS)
    })
  : null
watch([logSentinelRef, () => visibleLogGroups.value.length], async ([el]) => {
  logObserver?.disconnect()
  if (!el) return
  await nextTick()
  logObserver?.observe(el)
})
// Content changes (switching to the log, a load) move what's on top too.
watch([viewMode, () => visibleLogGroups.value.length], async () => {
  await nextTick()
  // The log fades in (unfold transition) — wait for its groups to exist.
  requestAnimationFrame(updateLogMonth)
}, { immediate: true })

onBeforeUnmount(() => {
  logObserver?.disconnect()
  if (logLoadTimer) clearTimeout(logLoadTimer)
})

const doneOnDay = computed(() => selectedDate.value ? store.completedOn(selectedDate.value) : [])
const workedOnDay = computed(() => selectedDate.value ? store.workedOn(selectedDate.value) : [])
// Own section at the end of the day's list (see the template) rather than
// mixed into doneOnDay/workedOnDay — Checks aren't Todos, ticking one is a
// different kind of event than completing/working a Todo.
const checksOnDay = computed(() => selectedDate.value && themeStore.checksEnabled ? checksStore.completedOn(selectedDate.value) : [])
// Subs completed this day, per parent todo — a todo can show up here even
// on a day it was never itself Done/Done-for-now (see dayEntries below),
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
// A past day is left out — the only past focusDates that still exist are
// yesterday's leftovers (see stores/todos.ts's leftoversFrom), which never
// happened on that day and shouldn't read as its plan in hindsight.
const plannedOnDay = computed(() => {
  if (!selectedDate.value || !themeStore.dateListsEnabled || selectedDate.value < todayStr()) return []
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

// Each entry keeps its own done/worked "kind" (double vs. single circle check) even
// though the day's list is no longer *grouped* by that — see dayEntries
// below. What was actually finished vs. just touched today is still worth
// showing per item, it's just not the more interesting question for a
// retrospective glance at the day. A todo that only had subs ticked today
// (never itself Done/Done-for-now) still counts as "worked" here — Done-
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
    <!-- Phone only — desktop has it in App.vue's left sidebar, tablet in App.vue's header. -->
    <div class="view-toggle calendar-mode-toggle">
      <CalendarModeToggle />
      <!-- Phone: the log's month marker sits at the right end of this row
           (see .log-month-row below for tablet/desktop). -->
      <Transition name="log-month" mode="out-in">
        <span v-if="showLogMonth" :key="logMonth" class="log-month">{{ logMonth }}</span>
      </Transition>
    </div>

    <motion.div
      v-if="viewMode === 'calendar'"
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

    <!-- Tablet/desktop: the log's month marker, left, right above the
         divider (phone: in the toggle row above instead). -->
    <div v-if="viewMode === 'log'" class="log-month-row">
      <Transition name="log-month" mode="out-in">
        <span v-if="showLogMonth" :key="logMonth" class="log-month">{{ logMonth }}</span>
      </Transition>
    </div>

    <ScrollDivider class="day-scroll-divider" :visible="dayDetailScrolled" />

    <div ref="dayDetailScrollRef" class="day-detail-scroll" @scroll="onDayDetailScroll">
      <div ref="dayDetailRef" class="day-detail calendar-inner">
        <transition
          name="unfold"
          mode="out-in"
          @after-enter="updateLogMonth"
          appear
          appear-active-class="unfold-appear-active"
          appear-from-class="unfold-appear-from"
        >
          <div v-if="viewMode === 'log'" key="log" class="day-detail-content">
            <template v-if="logGroups.length">
              <p v-if="!visibleLogGroups.length" class="no-activity">Nothing completed in the last {{ LOG_WINDOW_DAYS }} days.</p>
              <div v-for="group in visibleLogGroups" :key="group.dateStr" :data-date="group.dateStr" class="log-group" :class="{ 'log-group--new': newLogDates.has(group.dateStr) }">
                <p class="log-day-label" :style="logDomino(group.dateStr, 0)">{{ group.label }}</p>
                <div class="day-items">
                  <div v-for="(todo, i) in group.todos" :key="todo.id" class="day-item" :style="logDomino(group.dateStr, i + 1)">
                    <span class="icon"><CircleCheckIcon double :filled="todo.tags.includes(PRIORITY_TAG_ID)" size="1em" /></span>
                    <span class="day-item-title">{{ todo.title }}</span>
                    <span class="day-undo-slot"><UndoDoneButton :todo-id="todo.id" /></span>
                  </div>
                </div>
              </div>
              <div v-if="nextOlderLogGroup" class="log-more" aria-hidden="true">
                <div ref="logSentinelRef" class="log-sentinel" />
              </div>
            </template>
            <p v-else class="no-activity">Nothing completed yet.</p>
          </div>

          <div v-else :key="selectedDate" class="day-detail-content">
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
              <!-- Only while the day has no history either — once something
                   is already done/worked on, "nothing planned yet" reads
                   as if nothing happened. -->
              <p v-else-if="!hasActivity" class="day-plan-empty">no activities planned for this day yet</p>

              <div class="day-actions">
                <span
                  class="icon-side-label"
                  :class="plannedOnDay.length ? 'icon-side-label--left' : 'icon-side-label--right'"
                >
                  <span class="icon-side-label-text">add</span>
                  <button type="button" class="icon-circle-btn" v-tooltip="'plan this day in overview'" @click="planThisDay">
                    <Plus :size="10" />
                  </button>
                </span>
                <span v-if="plannedOnDay.length" class="icon-side-label icon-side-label--right">
                  <button type="button" class="icon-circle-btn" v-tooltip="'edit this day\'s list in current'" @click="editThisDayList">
                    <Pencil :size="10" />
                  </button>
                  <span class="icon-side-label-text">edit</span>
                </span>
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
                    <span class="icon"><CircleCheckIcon :double="entry.kind === 'done'" filled size="1em" /></span>
                    <span class="day-item-title">{{ entry.todo.title }}</span>
                    <span v-if="entry.kind === 'done' && !entry.todo.deletedAt" class="day-undo-slot"><UndoDoneButton :todo-id="entry.todo.id" /></span>
                  </div>
                  <div v-if="entry.subs.length" class="day-subs">
                    <div v-for="sub in entry.subs" :key="sub.id" class="day-sub-item"><span>–</span><span>{{ sub.title }}</span></div>
                  </div>
                </div>
                <div v-if="priorityEntries.length && otherEntries.length" class="day-group-spacer" />
                <div v-for="entry in otherEntries" :key="entry.todo.id" class="day-entry">
                  <div class="day-item">
                    <span class="icon"><CircleCheckIcon :double="entry.kind === 'done'" size="1em" /></span>
                    <span class="day-item-title">{{ entry.todo.title }}</span>
                    <span v-if="entry.kind === 'done' && !entry.todo.deletedAt" class="day-undo-slot"><UndoDoneButton :todo-id="entry.todo.id" /></span>
                  </div>
                  <div v-if="entry.subs.length" class="day-subs">
                    <div v-for="sub in entry.subs" :key="sub.id" class="day-sub-item"><span>–</span><span>{{ sub.title }}</span></div>
                  </div>
                </div>
                <div v-if="(priorityEntries.length || otherEntries.length) && checksOnDay.length" class="day-group-spacer" />
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

/* The day's entries share the calendar grid's own width cap
   (.calendar-inner, 640px) on every viewport — a narrower column left long
   titles wrapping in a thin strip with lots of empty space beside it. */
.day-detail {
  /* An entry's text size and the gap after its icon — shared by .day-item
     itself and .day-subs' indent, which has to clear exactly that icon
     column (the icon is 1em of this size, see .icon). Phone shrinks the
     size below. */
  --day-item-font-size: 20px;
  --day-item-icon-gap: 10px;
  /* Quieter secondary text in the day detail — the empty-state messages
     (.day-plan-empty/.no-activity) and the planned entries share it.
     Phone shrinks it along with the entries (see below). */
  --day-aside-font-size: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  width: 100%;
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
  font-size: var(--day-aside-font-size);
  font-weight: bold;
  color: var(--ink);
  font-family: var(--font-playful, sans-serif);
  text-align: center;
}

/* Sits centered under the planned list (or its empty state). Icon buttons
   themselves are .icon-circle-btn, shared with Current.vue's Checks
   add/edit icons via base.css, no local redefinition. Each icon's own
   label unrolls sideways on hover — add's to its left, edit's to its
   right — via base.css's .icon-side-label, absolutely positioned so an
   unrolling label never affects layout: the two icons stay exactly where
   they are, only the label grows into the empty space beside them. */
.day-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}

.planned-items-label,
.log-day-label {
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

/* Same size as the empty-state messages (--day-aside-font-size) — doubled
   class so it beats .day-item's own font-size, which comes later in this
   file at the same specificity. */
.day-item.day-item--planned {
  font-size: var(--day-aside-font-size);
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
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--day-item-icon-gap);
  font-size: var(--day-item-font-size);
  font-weight: bold;
  color: var(--ink);
  font-family: var(--font-playful, sans-serif);
}

/* Completed subs for that same day, nested under their parent todo — same
   lower-weight opacity treatment as Checks (.day-item--check) rather than
   a new color, matching the app's four-value color rule. Indented past
   the circle-check icon column (+ its 10px gap) so it reads as belonging to
   the todo above it. */
.day-subs {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: calc(var(--day-item-font-size) + var(--day-item-icon-gap));
  opacity: 0.65;
}

/* Dash and title as two flex items, so a wrapped title's further lines
   stay aligned under its own first line (hanging indent) instead of
   running back under the dash. */
.day-sub-item {
  display: flex;
  gap: 0.3em;
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  font-family: var(--font-playful, sans-serif);
  word-break: break-word;
}

.day-sub-item > :first-child {
  flex-shrink: 0;
}

.day-sub-item > :last-child {
  min-width: 0;
}

.icon {
  /* Inherits .day-item's font-size (the icon itself is 1em) and is exactly
     one of its line-heights tall, so the icon centers on the first line of
     the title at any text size — no per-size nudging needed. */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 1lh;
  flex-shrink: 0;
  color: var(--ink);
}

/* Checks read as lower-weight than Todos everywhere else in the app (see
   Current's own check-row) — same treatment here via opacity rather than a
   separate color, which the app's four-value color rule doesn't allow. */
.day-item--check {
  opacity: 0.65;
}

/* Dot instead of a circle icon, but in the same 1em-wide column. */
.icon--check {
  width: 1em;
}

.icon-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

/* Plain space between the priority / other / checks groups — the filled
   vs. outlined icons already tell priority apart, no line needed. Adds to
   .day-items' own gap on both sides. */
.day-group-spacer {
  height: 12px;
}

.no-activity {
  font-size: var(--day-aside-font-size);
  font-weight: bold;
  color: var(--ink);
  font-family: var(--font-playful, sans-serif);
}

/* Empty-state messages read pale, set back from real entries — both of
   them, since .day-plan-empty stands in for .no-activity (see above). */
.no-activity,
.day-plan-empty {
  opacity: 0.5;
}

/* calendar | log switch for phone — desktop shows it in App.vue's left
   sidebar, tablet in App.vue's header row instead. */
.view-toggle {
  display: none;
  justify-content: flex-start;
}

@media (max-width: 700px) {
  .view-toggle {
    display: flex;
  }
}

/* Takes the rest of the row so an Undo button after it sits at the far
   right, and a wrapped second line stays under the title. */
.day-item-title {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

/* The undo button gets its own column at the right edge: every entry (and
   its subs) keeps that column free, whether or not it has an undo button
   itself — so long titles all wrap at the same edge instead of some
   running on into the space others leave for the button. */
.day-items {
  --day-undo-col: calc(var(--icon-circle-btn-size) + var(--day-item-icon-gap));
}

.day-item,
.day-subs {
  padding-right: var(--day-undo-col);
}

/* One line-height tall, like .icon — centers the button on the title's
   first line at any text size. */
.day-undo-slot {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  height: 1lh;
}

/* Month + year of the log's topmost group in view (see updateLogMonth).
   Tablet/desktop: a little clear of the divider, in the page's own top
   padding above it (.content-inner) — a zero-height row the label hangs
   up out of, so it takes no space of its own and nothing above the
   divider moves (tight line-height so it fits that padding).
   Right-aligned (on tablet that's right under the header's settings
   icon). Phone: right end of the calendar | log row
   (.view-toggle) instead, this row hidden. Same type as the date between
   Current's prev/next arrows (shared tokens). */
.log-month-row {
  position: relative;
  flex-shrink: 0;
  height: 0;
}

.log-month-row .log-month {
  position: absolute;
  bottom: 8px;
  line-height: 1;
  right: 0;
}

.log-month {
  color: var(--ink);
  font-size: var(--date-label-font-size);
  line-height: 1.2;
  font-weight: var(--date-label-font-weight);
  font-family: var(--font-playful, sans-serif);
  white-space: nowrap;
}

.view-toggle .log-month {
  margin-left: auto;
}

@media (max-width: 700px) {
  .log-month-row {
    display: none;
  }

  .view-toggle {
    align-items: center;
  }
}

.log-month-enter-active,
.log-month-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.log-month-enter-from,
.log-month-leave-to {
  opacity: 0;
}

.log-month-enter-from {
  transform: translateY(4px);
}

.log-month-leave-to {
  transform: translateY(-4px);
}

/* Run-out past the last entry (see logSentinelRef) — room to scroll on
   into before the next part loads, the marker at its far end. Stays
   below the list after a load, ready for the next one. */
.log-more {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 120px;
}

.log-sentinel {
  height: 1px;
}

/* A loaded part tips in row by row (index from logDomino) — the same
   pop as the rest of the app's unfolding bits (--ease-pop). */
.log-group--new .log-day-label,
.log-group--new .day-item {
  animation: log-domino 0.34s var(--ease-pop) backwards;
  animation-delay: calc(var(--i, 0) * 45ms);
}

@keyframes log-domino {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.96);
  }
}

.log-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.unfold-enter-active,
.unfold-leave-active { transition: opacity 0.09s; }
.unfold-enter-from,
.unfold-leave-to { opacity: 0; }

/* Only for the very first mount (switching into the Calendar view) — timed
   to match the calendar grid's own entrance spring (see .calendar-inner)
   so both arrive together, instead of the day's entry (day-switch fade
   above) finishing far ahead of the grid. */
.unfold-appear-active { transition: opacity 0.32s var(--ease-pop), transform 0.32s var(--ease-pop); }
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

/* Top divider (entries scrolled under the calendar) on every viewport.
   The bottom one only makes sense on phone, above its fixed bottom nav —
   hidden everywhere else. */
.day-scroll-divider {
  flex-shrink: 0;
}

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
  .day-scroll-divider-bottom {
    display: block;
    position: fixed;
    bottom: 60px;
    left: 0;
    right: 0;
    pointer-events: none;
  }

  /* Room between the calendar | log switch and the calendar below it. */
  .view-toggle {
    margin-bottom: 18px;
  }

  /* Smaller grid on phone than on tablet (see the tablet block below) and
     desktop (base sizes above). */
  .cal :deep(.vc-title) {
    font-size: 17px !important;
  }

  .cal :deep(.vc-weekday) {
    font-size: 12px !important;
  }

  .cal :deep(.vc-day-content) {
    width: 28px !important;
    height: 28px !important;
    font-size: 14px !important;
  }

  /* Day headline — uppercase, so the longest one ("WEDNESDAY, SEPTEMBER
     30, 2026") needs to get this small to stay on one line on a phone. */
  .day-label {
    font-size: 16px;
    font-weight: 700;
  }

  /* The day's/log's entries, scaled down along with the grid — plus the
     empty-state messages standing in for them, so those never read bigger
     than the entries they replace. */
  .day-detail {
    --day-item-font-size: 16px;
    --day-aside-font-size: 16px;
  }

  .day-sub-item {
    font-size: 13px;
  }
}
/* Tablet: a step down from desktop's grid, a step up from phone's. */
@media (min-width: 701px) and (max-width: 1024px) {
  .cal :deep(.vc-title) {
    font-size: 20px !important;
  }

  .cal :deep(.vc-weekday) {
    font-size: 14px !important;
  }

  .cal :deep(.vc-day-content) {
    width: 32px !important;
    height: 32px !important;
    font-size: 16px !important;
  }
}
</style>

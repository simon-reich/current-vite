<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { nextLoopOccurrence } from '../composables/useLoopSchedule'
import { todayStr } from '../composables/useToday'
import type { LoopInterval, LoopUnit } from '../stores/todos'
import DatePickerModal from './DatePickerModal.vue'

const props = withDefaults(defineProps<{
  modelValue?: LoopInterval
  /** Set when the todo is also tagged priority: that card fills solid
   *  ink, which would swallow this picker's own ink-colored border/text
   *  entirely — swap to bg-colored controls so they stay legible. */
  inverted?: boolean
  /** false hides the once/loop toggle row entirely, for callers whose
   *  schedule is always recurring (Checks — see CLAUDE.md's Checks
   *  section) and has no once/loop distinction to begin with. */
  allowOnce?: boolean
  /** false hides the "shift schedule when done late" toggle — for callers
   *  whose schedule type has no field to persist it in (Checks' own
   *  CheckSchedule, unlike Todo's LoopInterval, has no
   *  rescheduleFromCompletion — see CheckModal.vue's updateSchedule,
   *  which strips it back out). Showing it there would look togglable
   *  but silently never stick. */
  allowReschedule?: boolean
}>(), {
  allowOnce: true,
  allowReschedule: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: LoopInterval]
  /** Fired when the custom day count or date field gains real focus —
   *  both need it to actually work, which blurs whatever else was
   *  focused before (e.g. App.vue's add-todo input). Lets a host that
   *  auto-closes/resets on that blur (see App.vue's onTodoBlur) know
   *  this wasn't the user leaving. */
  'focus-inside': []
}>()

const presetRow1: { label: string; unit: LoopUnit; count: number }[] = [
  { label: 'daily', unit: 'day', count: 1 },
  { label: 'weekly', unit: 'week', count: 1 },
]
const presetRow2: { label: string; unit: LoopUnit; count: number }[] = [
  { label: 'monthly', unit: 'month', count: 1 },
  { label: 'yearly', unit: 'year', count: 1 },
]
const presets = [...presetRow1, ...presetRow2]

const weekdayOptions: { label: string; day: number }[] = [
  { label: 'mo', day: 1 },
  { label: 'tu', day: 2 },
  { label: 'we', day: 3 },
  { label: 'th', day: 4 },
  { label: 'fr', day: 5 },
  { label: 'sa', day: 6 },
  { label: 'su', day: 0 },
]

// Absent mode means legacy data (pre-dates this field, always had
// unit+count set) — treat exactly as it already behaved: a loop.
const mode = computed(() => props.modelValue?.mode ?? 'loop')

function selectMode(m: 'once' | 'loop') {
  if (m === 'once') {
    emit('update:modelValue', { mode: 'once', startDate: startDate.value })
    return
  }
  // Reuses a previous loop config if the user flips once→loop→once→loop
  // rather than losing it; defaults to daily the first time, same as
  // checking the Date tag itself used to before Once became the default.
  emit('update:modelValue', {
    mode: 'loop',
    unit: props.modelValue?.unit ?? 'day',
    count: props.modelValue?.count ?? 1,
    startDate: startDate.value,
    rescheduleFromCompletion: props.modelValue?.rescheduleFromCompletion,
  })
}

function sameUnitCount(a: LoopInterval | undefined, unit: LoopUnit, count: number): boolean {
  return !!a && a.unit === unit && a.count === count
}

// Anything that isn't an exact preset match (including nothing set yet)
// counts as "Custom" — covers both a genuinely custom every-X-days value
// and the not-yet-decided state right after switching into loop mode.
// weekdays is its own thing entirely (see isWeekdaysMode/weekday buttons
// below), never "a custom day count".
const isCustom = computed(() => props.modelValue?.unit !== 'weekdays' && !presets.some(p => sameUnitCount(props.modelValue, p.unit, p.count)))

const isWeekdaysMode = computed(() => props.modelValue?.unit === 'weekdays')
const selectedWeekdays = computed(() => isWeekdaysMode.value ? (props.modelValue!.weekdays ?? []) : [])

// First time in: defaults to Mon–Fri, the most common "workday routine"
// pick. Flipping to another unit and back reuses whatever was selected
// rather than losing it, same idea as selectMode's once↔loop handling.
function selectWeekdaysMode() {
  const weekdays = isWeekdaysMode.value && props.modelValue!.weekdays?.length ? props.modelValue!.weekdays! : [1, 2, 3, 4, 5]
  emit('update:modelValue', { mode: 'loop', unit: 'weekdays', weekdays, startDate: startDate.value, rescheduleFromCompletion: props.modelValue?.rescheduleFromCompletion })
}

function toggleWeekday(day: number) {
  const next = selectedWeekdays.value.includes(day)
    ? selectedWeekdays.value.filter(d => d !== day)
    : [...selectedWeekdays.value, day].sort((a, b) => a - b)
  emit('update:modelValue', { mode: 'loop', unit: 'weekdays', weekdays: next, startDate: startDate.value, rescheduleFromCompletion: props.modelValue?.rescheduleFromCompletion })
}

const MAX_CUSTOM_DAYS = 999

const customCount = ref(props.modelValue?.unit === 'day' && isCustom.value ? (props.modelValue.count ?? 2) : 2)

watch(() => props.modelValue, (v) => {
  if (v?.unit === 'day' && isCustom.value) customCount.value = v.count ?? 2
})

// The date to count the recurrence from — kept as-is across preset/count
// changes, only the "from" picker below touches it directly.
const startDate = computed(() => props.modelValue?.startDate ?? todayStr())

// Display-only DD/MM/YYYY — startDate itself stays ISO (YYYY-MM-DD) since
// that's what sorts/compares correctly and matches the rest of the data
// model (completedAt, workLog).
const startDateDisplay = computed(() => {
  const [y, m, d] = startDate.value.split('-')
  return `${d}/${m}/${y}`
})

function select(unit: LoopUnit, count: number) {
  emit('update:modelValue', { mode: 'loop', unit, count, startDate: startDate.value, rescheduleFromCompletion: props.modelValue?.rescheduleFromCompletion })
}

function applyCustomCount() {
  const count = Math.min(MAX_CUSTOM_DAYS, Math.max(1, Math.round(customCount.value) || 1))
  customCount.value = count
  emit('update:modelValue', { mode: 'loop', unit: 'day', count, startDate: startDate.value, rescheduleFromCompletion: props.modelValue?.rescheduleFromCompletion })
}

// maxlength doesn't actually clamp type="number" inputs in most browsers
// — Math.min in applyCustomCount only kicks in on change/blur, so typing
// a 4th+ digit still showed while focused. Truncate live instead.
function onCustomCountInput(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.value.length > 3) {
    input.value = input.value.slice(0, 3)
    customCount.value = Number(input.value)
  }
}

function updateStartDate(date: string) {
  const base = props.modelValue ?? { mode: 'once' as const, startDate: date }
  emit('update:modelValue', { ...base, startDate: date })
}

// No effect on 'weekdays' (due-ness there is pure day-of-week, startDate
// is just an anchor for the forward search) — hidden for that unit rather
// than shown as a no-op toggle.
function toggleReschedule() {
  if (!props.modelValue) return
  emit('update:modelValue', { ...props.modelValue, rescheduleFromCompletion: !props.modelValue.rescheduleFromCompletion })
}

// The "from" date picker opens as a centered modal (see DatePickerModal.vue
// for why) rather than a popover anchored to the trigger.
const showDateModal = ref(false)

// Next due date given the currently selected values — recomputed on every
// unit/count/startDate change so a stale interval (startDate far in the
// past, large custom day count) stays legible instead of leaving the user
// to do the recurrence math themselves.
const nextOccurrence = computed(() => props.modelValue ? nextLoopOccurrence(props.modelValue) : null)

// 'once' can point at a past date and stays due until actually completed
// (see isLoopDueToday) — negative days reads as "overdue" rather than the
// nonsensical "in -3 days".
const nextOccurrenceRelative = computed(() => {
  const next = nextOccurrence.value
  if (!next) return ''
  const today = new Date()
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((next.getTime() - t.getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days < 0) return `${-days} days overdue`
  return `in ${days} days`
})

// Nothing selected yet in weekdays mode is the one dead end
// nextLoopOccurrence can't resolve (returns null) — steer the user there
// instead of just showing a blank line.
const loopNextText = computed(() => {
  if (isWeekdaysMode.value && !selectedWeekdays.value.length) return 'select at least one day'
  return nextOccurrenceRelative.value
})
</script>

<template>
  <div class="loop-picker" :class="{ inverted }" @click.stop>
    <div v-if="allowOnce" class="loop-row">
      <button
        type="button"
        class="loop-opt"
        :class="{ active: mode === 'once', dimmed: mode !== 'once' }"
        @mousedown.prevent
        @click="selectMode('once')"
      >
        once
      </button>
      <button
        type="button"
        class="loop-opt"
        :class="{ active: mode === 'loop', dimmed: mode !== 'loop' }"
        @mousedown.prevent
        @click="selectMode('loop')"
      >
        loop
      </button>
    </div>

    <div class="loop-row">
      <div class="loop-from">
        <span>{{ mode === 'once' ? 'due' : 'starts' }}</span>
        <button
          type="button"
          class="loop-date-btn"
          title="Change date"
          @mousedown.prevent
          @click="showDateModal = true"
        >
          {{ startDateDisplay }}
        </button>
      </div>
    </div>

    <template v-if="mode === 'loop'">
      <div class="loop-row">
        <button
          v-for="preset in presets"
          :key="preset.label"
          type="button"
          class="loop-opt"
          :class="{ active: sameUnitCount(modelValue, preset.unit, preset.count), dimmed: !sameUnitCount(modelValue, preset.unit, preset.count) }"
          @mousedown.prevent
          @click="select(preset.unit, preset.count)"
        >
          {{ preset.label }}
        </button>
      </div>

      <div class="loop-row">
        <button
          type="button"
          class="loop-opt"
          :class="{ active: isWeekdaysMode, dimmed: !isWeekdaysMode }"
          @mousedown.prevent
          @click="selectWeekdaysMode"
        >
          weekdays
        </button>
        <template v-if="isWeekdaysMode">
          <button
            v-for="d in weekdayOptions"
            :key="d.day"
            type="button"
            class="loop-opt loop-opt--day"
            :class="{ active: selectedWeekdays.includes(d.day), dimmed: !selectedWeekdays.includes(d.day) }"
            @mousedown.prevent
            @click="toggleWeekday(d.day)"
          >
            {{ d.label }}
          </button>
        </template>
      </div>

      <div class="loop-row">
        <div class="loop-custom" :class="{ dimmed: !isCustom }">
          <span>every</span>
          <input
            type="number"
            min="1"
            :max="MAX_CUSTOM_DAYS"
            maxlength="3"
            class="loop-custom-input"
            v-model.number="customCount"
            @focus="!isCustom && applyCustomCount(); emit('focus-inside')"
            @input="onCustomCountInput"
            @change="applyCustomCount"
          />
          <span>days</span>
        </div>
      </div>

      <div v-if="allowReschedule && !isWeekdaysMode" class="loop-row">
        <button
          type="button"
          class="loop-toggle"
          :class="{ active: !!modelValue?.rescheduleFromCompletion }"
          title="Count the next occurrence from when it's checked off, not the fixed schedule"
          @mousedown.prevent
          @click="toggleReschedule"
        >
          <span class="loop-toggle-box" />
          updates when done
        </button>
      </div>

      <div class="loop-row">
        <span class="loop-next">{{ loopNextText }}</span>
      </div>
    </template>

    <DatePickerModal
      v-if="showDateModal"
      :model-value="startDate"
      @update:model-value="updateStartDate"
      @close="showDateModal = false"
    />
  </div>
</template>

<style scoped>
.loop-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.loop-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.loop-opt {
  width: 74px;
  text-align: center;
  font-size: 12px;
  color: var(--ink);
  cursor: pointer;
  padding: 4px 6px;
  border: 2px solid var(--ink);
  border-radius: var(--radius);
  background: none;
  user-select: none;
  transition: color 0.1s, background 0.1s, opacity 0.1s;
  font-family: var(--font-mono, monospace);
}

.loop-opt.active {
  background: var(--ink);
  color: var(--bg);
}

.loop-opt.dimmed {
  opacity: 0.35;
}

.loop-opt--day {
  width: 34px;
  padding: 4px 0;
}

.inverted .loop-opt {
  border-color: var(--bg);
  color: var(--bg);
}

.inverted .loop-opt.active {
  background: var(--bg);
  color: var(--ink);
}

.loop-custom {
  display: flex;
  align-items: center;
  gap: 5px;
  padding-left: 4px;
  color: var(--ink);
  font-size: 14px;
  font-family: var(--font-mono, monospace);
  cursor: default;
  transition: opacity 0.1s;
}

.loop-custom.dimmed {
  opacity: 0.35;
}

.inverted .loop-custom {
  color: var(--bg);
}

.inverted .loop-custom-input {
  color: var(--bg);
  border-bottom-color: var(--bg);
}

.loop-custom-input {
  width: 34px;
  color: var(--ink);
  background: none;
  border: none;
  border-bottom: 1px solid var(--ink);
  font-family: var(--font-mono, monospace);
  font-size: 14px;
  text-align: center;
  outline: none;
  padding: 0 0 2px;
  /* Hide the native spinner arrows — they don't match anything else in
     the app's own control styling. */
  -moz-appearance: textfield;
}

.loop-custom-input::-webkit-outer-spin-button,
.loop-custom-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.loop-toggle {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 2px 0;
  border: none;
  background: none;
  color: var(--ink);
  opacity: 0.55;
  font-size: 12px;
  font-family: var(--font-mono, monospace);
  cursor: pointer;
  transition: opacity 0.1s;
}

.loop-toggle.active {
  opacity: 1;
}

.loop-toggle-box {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  border: 2px solid var(--ink);
  /* Same idea as Checks' checkbox (see CLAUDE.md) — tracks
     rounded/square, but capped at 3px so a box this small doesn't turn
     into a full circle in rounded mode. */
  border-radius: min(var(--radius), 3px);
  background: none;
}

.loop-toggle.active .loop-toggle-box {
  background: var(--ink);
}

.inverted .loop-toggle {
  color: var(--bg);
}

.inverted .loop-toggle-box {
  border-color: var(--bg);
}

.inverted .loop-toggle.active .loop-toggle-box {
  background: var(--bg);
}

.loop-next {
  padding-left: 4px;
  color: var(--ink);
  opacity: 0.6;
  font-size: 12px;
  font-family: var(--font-mono, monospace);
}

.inverted .loop-next {
  color: var(--bg);
}

.loop-from {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 4px;
  color: var(--ink);
  font-size: 14px;
  font-family: var(--font-mono, monospace);
}

.inverted .loop-from {
  color: var(--bg);
}

.loop-date-btn {
  border: none;
  border-bottom: 1px solid var(--ink);
  background: none;
  padding: 0 0 2px;
  color: var(--ink);
  font-family: var(--font-mono, monospace);
  font-size: 14px;
  cursor: pointer;
}

.inverted .loop-date-btn {
  color: var(--bg);
  border-bottom-color: var(--bg);
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useThemeStore } from '../stores/theme'
import { todayStr, tomorrowStr } from '../composables/useToday'
import DatePickerModal from './DatePickerModal.vue'

// The Overview-only control for picking which date new "plan ahead"
// assignments (swipe-split top zone, the per-card calendar icon) go to —
// see CLAUDE.md's Date Lists section. There is deliberately only this one
// pill rendering — no separate icon-only trigger anywhere, on any
// breakpoint; the widget itself is always the one and only way to open
// the date picker. Rendered at whichever spots App.vue/AllTodos.vue place
// it per breakpoint (desktop/tablet/phone) — this component itself is
// breakpoint-agnostic, callers control visibility/position via CSS.
const themeStore = useThemeStore()
const showModal = ref(false)

// Same "today"/"tomorrow" special-casing as the Current sidebar's Date-List
// nav (see App.vue) and TodoCard's swipe-zone label — this widget picks
// the very same date those plan onto, so it should read the same way. No
// weekday/year anymore (see .focus-date-widget's own comment) — just this
// one centered label, so the pill stays a fixed size regardless of content
// instead of growing for "tomorrow".
function displayLabel(dateStr: string): string {
  if (dateStr === todayStr()) return 'today'
  if (dateStr === tomorrowStr()) return 'tomorrow'
  const [, m, d] = dateStr.split('-')
  return `${d}.${m}`
}

const display = computed(() => displayLabel(themeStore.selectedFocusDate))

function pick(dateStr: string) {
  themeStore.setSelectedFocusDate(dateStr)
}
</script>

<template>
  <button
    type="button"
    class="focus-date-widget"
    title="Change the plan-ahead target date"
    @click="showModal = true"
  >
    {{ display }}
  </button>

  <DatePickerModal
    v-if="showModal"
    :model-value="themeStore.selectedFocusDate"
    @update:model-value="pick"
    @close="showModal = false"
  />
</template>

<style scoped>
/* Same look as the add-todo input (see .add-input in layout.css) — bg
   fill, ink border/text, shadow only downward (no x-offset) in ink —
   rather than its own separate style. Fixed width (sized to fit
   "tomorrow", the longest label this ever shows) and centered content
   instead of the old weekday/day-month/year grid — that grid grew wider
   for "tomorrow" than for a plain day/month pair, visibly resizing the
   pill depending on which date happened to be selected. */
.focus-date-widget {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 92px;
  padding: 8px 4px;
  background: var(--bg);
  color: var(--ink);
  border: 2px solid var(--ink);
  border-radius: var(--radius);
  box-shadow: 0 5px 0 var(--ink);
  cursor: pointer;
  font-family: var(--font-mono, monospace);
  font-size: 16px;
  font-weight: 700;
  transition: border-color 0.15s;
}

.focus-date-widget:hover {
  border-color: var(--ink-dark);
}
</style>

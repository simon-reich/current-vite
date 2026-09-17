<script setup lang="ts">
import { computed, ref } from 'vue'
import { useThemeStore } from '../stores/theme'
import { WEEKDAY_LABELS } from '../composables/useToday'
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

function parts(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return {
    weekday: WEEKDAY_LABELS[date.getDay()],
    day: String(d).padStart(2, '0'),
    month: String(m).padStart(2, '0'),
    year: String(y),
  }
}

const display = computed(() => parts(themeStore.selectedFocusDate))

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
    <span class="fdw-weekday">{{ display.weekday }}</span>
    <span class="fdw-main">{{ display.day }} {{ display.month }}</span>
    <span class="fdw-year">{{ display.year }}</span>
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
   rather than its own separate style. */
.focus-date-widget {
  display: inline-grid;
  grid-template-columns: auto auto;
  grid-template-rows: auto auto;
  column-gap: 8px;
  align-items: center;
  padding: 6px 12px;
  background: var(--bg);
  color: var(--ink);
  border: 2px solid var(--ink);
  border-radius: var(--radius);
  box-shadow: 0 5px 0 var(--ink);
  cursor: pointer;
  font-family: var(--font-mono, monospace);
  transition: border-color 0.15s;
}

.focus-date-widget:hover {
  border-color: var(--ink-dark);
}

.fdw-weekday {
  grid-column: 1;
  grid-row: 1;
  font-size: 10px;
  letter-spacing: 0.5px;
}

.fdw-year {
  grid-column: 1;
  grid-row: 2;
  font-size: 10px;
}

.fdw-main {
  grid-column: 2;
  grid-row: 1 / span 2;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  padding-left: 4px;
  border-left: 2px solid var(--ink);
}
</style>

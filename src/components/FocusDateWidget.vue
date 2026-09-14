<script setup lang="ts">
import { computed, ref } from 'vue'
import { CalendarClock } from '@lucide/vue'
import { useThemeStore } from '../stores/theme'
import DatePickerModal from './DatePickerModal.vue'

// The Overview-only control for picking which date new "plan ahead"
// assignments (swipe-split top zone, the per-card calendar icon) go to —
// see CLAUDE.md's Date Lists section. Rendered at up to three different
// places in App.vue/AllTodos.vue depending on breakpoint (desktop/tablet/
// phone) — this component itself is breakpoint-agnostic, callers control
// visibility/position via CSS.
const props = withDefaults(defineProps<{
  /** Icon-only rendering for cramped spots (tablet's nav-icon rail)
   *  instead of the full mockup-style pill. */
  compact?: boolean
}>(), { compact: false })

const themeStore = useThemeStore()
const showModal = ref(false)

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

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
    v-if="compact"
    type="button"
    class="nav-icon focus-date-widget-compact"
    :title="`Plan-ahead target: ${display.day}/${display.month}/${display.year} — click to change`"
    @click="showModal = true"
  >
    <CalendarClock :size="24" />
  </button>
  <button
    v-else
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
.focus-date-widget {
  display: inline-grid;
  grid-template-columns: auto auto;
  grid-template-rows: auto auto;
  column-gap: 8px;
  align-items: center;
  padding: 6px 12px;
  background: var(--ink);
  color: var(--bg);
  border: 2px solid var(--ink);
  border-radius: var(--radius);
  box-shadow: 5px 5px 0 var(--ink-dark);
  cursor: pointer;
  font-family: var(--font-mono, monospace);
  transition: box-shadow 0.12s, transform 0.12s;
}

.focus-date-widget:hover {
  transform: translate(-1px, -1px);
  box-shadow: 6px 6px 0 var(--ink-dark);
}

.fdw-weekday {
  grid-column: 1;
  grid-row: 1;
  font-size: 10px;
  letter-spacing: 0.5px;
  opacity: 0.7;
}

.fdw-year {
  grid-column: 1;
  grid-row: 2;
  font-size: 10px;
  opacity: 0.7;
}

.fdw-main {
  grid-column: 2;
  grid-row: 1 / span 2;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  padding-left: 4px;
  border-left: 2px solid var(--bg);
}
</style>

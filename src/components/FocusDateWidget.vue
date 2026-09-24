<script setup lang="ts">
import { computed, ref } from 'vue'
import { useThemeStore } from '../stores/theme'
import { WEEKDAY_LABELS, todayStr, tomorrowStr } from '../composables/useToday'
import DatePickerModal from './DatePickerModal.vue'
import FocusDatePanel from './FocusDatePanel.vue'

// The Overview-only control for picking which date new "plan ahead"
// assignments (swipe-split top zone, the per-card calendar icon) go to —
// see CLAUDE.md's Date Lists section. There is deliberately only this one
// pill rendering — no separate icon-only trigger anywhere, on any
// breakpoint; the widget itself is always the one and only way to open
// the date picker. Rendered at whichever spots App.vue/AllTodos.vue place
// it per breakpoint (desktop/tablet/phone) — this component itself is
// breakpoint-agnostic, callers control visibility/position via CSS.
//
// `panel`: tablet's own instance sets this — instead of the plain
// centered DatePickerModal (desktop/phone's behavior, unchanged), a click
// opens FocusDatePanel.vue, a slide-in with the same calendar plus the
// today/tomorrow/upcoming Date-List nav desktop's sidebar already shows
// permanently (which tablet, without that sidebar, otherwise has no way
// to reach). Static per instance — never toggled at runtime.
//
// `modelValue`/`showCalendar`: Current's own phone instance (App.vue)
// passes both — repurposes this same pill, while viewing Current, into a
// picker for which Date List is being shown (viewingDate) instead of the
// "plan ahead" target (themeStore.selectedFocusDate), and drops the
// calendar since Current only ever needs the plain list of existing Date
// Lists, not a date-picker. Both are simply forwarded through to
// FocusDatePanel, which already knows how to fall back to
// themeStore.selectedFocusDate when modelValue is left unset — this
// component's own display/pick just need the same fallback for the pill's
// own face.
const props = defineProps<{ panel?: boolean; modelValue?: string; showCalendar?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [dateStr: string] }>()
const themeStore = useThemeStore()
const showModal = ref(false)
const showPanel = ref(false)

// Mechanical flip-calendar look: weekday/year stacked in their own cell,
// day and month as two separate cells. For "today"/"tomorrow" (same
// special-casing as the Current sidebar's Date-List nav and TodoCard's
// swipe-zone label) the day/month cells collapse into one centered label
// instead — a bare number pair wouldn't mean "today" on its own the way
// the word does.
function parts(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const isToday = dateStr === todayStr()
  const isTomorrow = dateStr === tomorrowStr()
  return {
    special: isToday || isTomorrow,
    main: isToday ? 'today' : isTomorrow ? 'tomorrow' : '',
    weekday: WEEKDAY_LABELS[date.getDay()],
    day: String(d).padStart(2, '0'),
    month: String(m).padStart(2, '0'),
    year: String(y),
  }
}

const display = computed(() => parts(props.modelValue ?? themeStore.selectedFocusDate))

function pick(dateStr: string) {
  themeStore.setSelectedFocusDate(dateStr)
}

// Only reachable when a caller actually gave this instance a modelValue
// (Current's phone list-picker) — FocusDatePanel's own dual-mode
// activeDate only emits update:modelValue in that case, writing
// themeStore.selectedFocusDate itself otherwise (see its own comment), so
// there's nothing to forward when this fires from the plain "plan ahead"
// instance.
function onPanelPick(dateStr: string) {
  emit('update:modelValue', dateStr)
}

function open() {
  if (props.panel) showPanel.value = true
  else showModal.value = true
}
</script>

<template>
  <button
    type="button"
    class="focus-date-widget"
    :title="modelValue !== undefined ? 'Choose which Date List to view' : 'Change the plan-ahead target date'"
    @click="open"
  >
    <!-- Both branches always render, stacked on the same grid cell (see
         .fdw-row/.fdw-special below) — only one is ever visible, but
         visibility:hidden (not v-if/v-show, which both use display:none —
         removed from layout, contributes nothing to sizing) keeps the
         invisible one in the flow so the grid track auto-sizes to
         whichever of the two actually needs more room, in both
         directions. Guessing a single pixel width by hand (tried twice
         already) either leaves dead space or clips content the moment
         real font metrics don't match the guess. -->
    <div class="fdw-row" :class="{ 'fdw-hidden': display.special }">
      <div class="fdw-cell fdw-left">
        <span class="fdw-weekday">{{ display.weekday }}</span>
        <span class="fdw-year">{{ display.year }}</span>
      </div>
      <span class="fdw-cell fdw-num fdw-day">{{ display.day }}</span>
      <span class="fdw-cell fdw-num fdw-month">{{ display.month }}</span>
    </div>
    <span class="fdw-cell fdw-special" :class="{ 'fdw-hidden': !display.special }">{{ display.main }}</span>
  </button>

  <DatePickerModal
    v-if="showModal"
    :model-value="themeStore.selectedFocusDate"
    disable-past
    @update:model-value="pick"
    @close="showModal = false"
  />
  <FocusDatePanel
    v-if="panel"
    :open="showPanel"
    :model-value="modelValue"
    :show-calendar="showCalendar"
    @update:model-value="onPanelPick"
    @close="showPanel = false"
  />
</template>

<style scoped>
/* Mechanical flip-calendar look, not this app's usual flat pill — one of
   the few elements exempt from the rounded/square corner-radius setting
   (see CLAUDE.md's Personalisierung section): border-radius here is a
   fixed px value, never var(--radius), so it stays rounded either way.
   Same bg-fill/ink-border/ink-text/ink-shadow look as everything else in
   the app otherwise (see .add-input in layout.css) — no inverted fill.
   overflow:hidden clips the inner cell dividers to the rounded corners;
   it does NOT clip the box-shadow below (shadows paint outside the
   overflow-clipped content box, unaffected by an element's own
   overflow rule). */
.focus-date-widget {
  display: grid;
  box-sizing: border-box;
  /* Same overall thickness as the add-todo input (.add-input in
     layout.css: 2px border + 10px top/bottom padding around 17px text ≈
     44px) — border included since this is border-box, matching how that
     height reads including its own 2px border. */
  height: 44px;
  background: var(--bg);
  color: var(--ink);
  border: 2px solid var(--ink);
  border-radius: 14px;
  box-shadow: 0 5px 0 var(--ink);
  cursor: pointer;
  font-family: var(--font-mono, monospace);
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.focus-date-widget:hover {
  border-color: var(--ink-dark);
  box-shadow: 0 5px 0 var(--ink-dark);
}

/* The grid-stack trick: both children share the one implicit cell, so its
   auto track size becomes the max of what each of them actually needs —
   the browser measures this for real instead of either of us guessing a
   number. align/justify-items default to stretch on a grid already, so
   both fill the full cell in both axes without saying so explicitly. */
.fdw-row,
.fdw-special {
  grid-area: 1 / 1;
}

.fdw-row {
  display: flex;
  align-items: stretch;
}

.fdw-hidden {
  visibility: hidden;
}

.fdw-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

/* Weekday-over-year, split by its own thin horizontal rule — each sized
   to its own worst case (a 3-letter weekday, a 4-digit year) via
   min-width on the cell itself. */
.fdw-left {
  flex-direction: column;
  min-width: 40px;
  /* Vertical padding only — horizontal padding lives on the weekday/year
     text itself (below), not here, so their border-bottom (which spans an
     element's full border-box regardless of that element's own padding)
     actually reaches this cell's real edges: the pill's left border and
     the day-cell's divider, not just the padded content area in between. */
  padding: 3px 0;
  border-right: 1px solid var(--ink);
}

.fdw-weekday,
.fdw-year {
  /* Full cell width + right-aligned text, not the cell's own centering
     (that stays for the big day/month numbers) — matches the reference
     look. */
  width: 100%;
  box-sizing: border-box;
  padding: 0 6px;
  text-align: right;
  font-size: 10px;
  line-height: 1.4;
  letter-spacing: 0.5px;
}

.fdw-weekday {
  border-bottom: 1px solid var(--ink);
}

.fdw-num {
  min-width: 30px;
  padding: 2px 8px;
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
}

.fdw-day {
  border-right: 1px solid var(--ink);
}

.fdw-special {
  padding: 5px 14px;
  font-size: 15px;
  font-weight: 700;
}
</style>

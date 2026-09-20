<script setup lang="ts">
import { useThemeStore } from '../stores/theme'
import { useTodosStore } from '../stores/todos'
import { todayStr, tomorrowStr } from '../composables/useToday'
import { useFocusDateNav } from '../composables/useFocusDateNav'

// Overview's Date-List nav — picking a date sets the Focus-Date-Pille's
// target (themeStore.selectedFocusDate). Extracted out of App.vue's own
// desktop sidebar so the tablet slide-in panel (FocusDatePanel.vue) can
// reuse the exact same markup instead of a second copy (see CLAUDE.md's
// single-source-of-truth principle). Current's own variant (viewingDate-
// based, with its own "current" reset button) stays inline in App.vue —
// different click targets, not a fit for this component.
const themeStore = useThemeStore()
const store = useTodosStore()
const { hasTodayList, hasTomorrowList, presetWeekDates, upcomingFocusDates, formatPresetDate, formatUpcomingDate } = useFocusDateNav()
</script>

<template>
  <div class="tag-list">
    <button
      class="all-btn date-nav-btn"
      :class="{ active: themeStore.selectedFocusDate === todayStr(), dimmed: !hasTodayList }"
      @click="themeStore.setSelectedFocusDate(todayStr())"
    >
      today
    </button>
    <button
      class="all-btn date-nav-btn loop-btn"
      :class="{ active: themeStore.selectedFocusDate === tomorrowStr(), dimmed: !hasTomorrowList }"
      @click="themeStore.setSelectedFocusDate(tomorrowStr())"
    >
      tomorrow
    </button>

    <div
      v-for="dateStr in presetWeekDates.slice(2)"
      :key="dateStr"
      class="tag-chip date-nav-upcoming-chip"
      :class="{ active: themeStore.selectedFocusDate === dateStr, dimmed: !store.hasFocusDateList(dateStr) }"
    >
      <span class="tag-label date-nav-upcoming-btn" @click="themeStore.setSelectedFocusDate(dateStr)">{{ formatPresetDate(dateStr) }}</span>
    </div>

    <div
      v-for="dateStr in upcomingFocusDates"
      :key="dateStr"
      class="tag-chip date-nav-upcoming-chip"
      :class="{ active: themeStore.selectedFocusDate === dateStr }"
    >
      <span class="tag-label date-nav-upcoming-btn" @click="themeStore.setSelectedFocusDate(dateStr)">{{ formatUpcomingDate(dateStr) }}</span>
    </div>
  </div>
</template>

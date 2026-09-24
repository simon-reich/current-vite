<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from '../stores/theme'
import { useTodosStore } from '../stores/todos'
import { todayStr, tomorrowStr } from '../composables/useToday'
import { useFocusDateNav } from '../composables/useFocusDateNav'

// Overview's Date-List nav by default — picking a date sets the Focus-
// Date-Pille's target (themeStore.selectedFocusDate). Extracted out of
// App.vue's own desktop sidebar so the tablet/phone FocusDatePanel.vue can
// reuse the exact same markup instead of a second copy (see CLAUDE.md's
// single-source-of-truth principle). Current's own desktop sidebar variant
// (viewingDate-based, with its own "current" reset button) stays inline in
// App.vue — different click targets, not a fit for this component.
//
// Optional `modelValue`: lets a caller override what counts as "selected"
// and where a click goes, instead of always reading/writing
// themeStore.selectedFocusDate — Current's own phone list-picker (opened
// from its Focus-Date-Pille, see FocusDateWidget.vue/FocusDatePanel.vue)
// passes its viewingDate through this way, so the same markup can drive
// either target without a second copy of it.
const props = defineProps<{ modelValue?: string }>()
const emit = defineEmits<{ 'update:modelValue': [dateStr: string] }>()
const themeStore = useThemeStore()
const store = useTodosStore()
const { hasTodayList, hasTomorrowList, presetWeekDates, upcomingFocusDateGroups, formatPresetDate, formatUpcomingDate } = useFocusDateNav()

const activeDate = computed<string>({
  get: () => props.modelValue ?? themeStore.selectedFocusDate,
  set: (dateStr) => {
    if (props.modelValue !== undefined) emit('update:modelValue', dateStr)
    else themeStore.setSelectedFocusDate(dateStr)
  },
})
</script>

<template>
  <div class="tag-list">
    <button
      class="all-btn date-nav-btn"
      :class="{ active: activeDate === todayStr(), dimmed: !hasTodayList }"
      @click="activeDate = todayStr()"
    >
      today
    </button>
    <button
      class="all-btn date-nav-btn loop-btn"
      :class="{ active: activeDate === tomorrowStr(), dimmed: !hasTomorrowList }"
      @click="activeDate = tomorrowStr()"
    >
      tomorrow
    </button>

    <div class="date-nav-section-label">week</div>
    <div
      v-for="dateStr in presetWeekDates.slice(2)"
      :key="dateStr"
      class="tag-chip date-nav-upcoming-chip"
      :class="{ active: activeDate === dateStr, dimmed: !store.hasFocusDateList(dateStr) }"
    >
      <span class="tag-label date-nav-upcoming-btn" @click="activeDate = dateStr">{{ formatPresetDate(dateStr) }}</span>
    </div>

    <template v-for="(group, groupIndex) in upcomingFocusDateGroups" :key="group.label">
      <div class="date-nav-section-label" :class="{ 'date-nav-section-label--month-first': groupIndex === 0 }">{{ group.label }}</div>
      <div
        v-for="dateStr in group.dates"
        :key="dateStr"
        class="tag-chip date-nav-upcoming-chip"
        :class="{ active: activeDate === dateStr }"
      >
        <span class="tag-label date-nav-upcoming-btn" @click="activeDate = dateStr">{{ formatUpcomingDate(dateStr) }}</span>
      </div>
    </template>
  </div>
</template>

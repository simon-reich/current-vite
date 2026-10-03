<script setup lang="ts">
import { inject } from 'vue'
import type { Ref } from 'vue'

// The Calendar view's calendar | log switch — rendered in App.vue's desktop
// left sidebar and, below desktop width (no sidebar there), inside
// Calendar.vue itself. The mode ref lives in App.vue (provide/inject, same
// as viewingDate) since the sidebar sits outside the RouterView.
const mode = inject<Ref<'calendar' | 'log'>>('calendarViewMode')!
</script>

<template>
  <button type="button" class="all-btn date-nav-btn calendar-mode-btn" :class="{ active: mode === 'calendar' }" @click="mode = 'calendar'">calendar</button>
  <button type="button" class="all-btn date-nav-btn calendar-mode-btn" :class="{ active: mode === 'log' }" @click="mode = 'log'">log</button>
</template>

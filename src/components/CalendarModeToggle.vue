<script setup lang="ts">
import { inject } from 'vue'
import type { Ref } from 'vue'

// The Calendar view's journal | archive switch — rendered in App.vue's desktop
// left sidebar, App.vue's tablet header row, and on phone (no sidebar, no
// header on Calendar) inside Calendar.vue itself. The mode ref lives in App.vue (provide/inject, same
// as viewingDate) since the sidebar sits outside the RouterView.
const mode = inject<Ref<'journal' | 'archive'>>('calendarViewMode')!
</script>

<template>
  <button type="button" class="all-btn date-nav-btn calendar-mode-btn" :class="{ active: mode === 'journal' }" @click="mode = 'journal'">journal</button>
  <button type="button" class="all-btn date-nav-btn calendar-mode-btn" :class="{ active: mode === 'archive' }" @click="mode = 'archive'">archive</button>
</template>

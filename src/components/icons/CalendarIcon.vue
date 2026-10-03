<script setup lang="ts">
import { useThemeStore } from '../../stores/theme'

// Lucide's CalendarDays, path for path — but its frame corners and line
// caps follow Settings' rounded/square corner style (themeStore.rounded),
// which Lucide has no variant for. Set as SVG attributes rather than
// overridden from CSS: a stylesheet override (`rx: 0` etc.) didn't take
// effect on every browser (e.g. Firefox on Android kept it rounded).
withDefaults(defineProps<{ size?: number | string }>(), { size: 24 })
const themeStore = useThemeStore()
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    :stroke-linecap="themeStore.rounded ? 'round' : 'square'"
    :stroke-linejoin="themeStore.rounded ? 'round' : 'miter'"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" :rx="themeStore.rounded ? 2 : 0" />
    <path d="M3 10h18" />
    <path d="M8 14h.01" />
    <path d="M12 14h.01" />
    <path d="M16 14h.01" />
    <path d="M8 18h.01" />
    <path d="M12 18h.01" />
    <path d="M16 18h.01" />
  </svg>
</template>

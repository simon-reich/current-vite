<script setup lang="ts">
// Lucide's CircleCheck, plus a `double` variant Lucide has no icon for:
// the same circle around two parallel ticks staggered diagonally.
// One component for both so the single and double tick always share the
// exact same circle/stroke. Used for Done (double) vs. Done-for-today
// (single) in the Calendar's day detail and log. `filled` inverts it — ink
// circle, tick in the background color (priority entries).
withDefaults(defineProps<{ size?: number | string; double?: boolean; filled?: boolean }>(), { size: 24, double: false, filled: false })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="10" :fill="filled ? 'currentColor' : 'none'" />
    <!-- Two copies of the single tick below (same l2 2 4-4 shape/size),
         the second offset 5/3 down-right of the first so they stagger
         diagonally — that puts its start ~2.8 units off the first tick's
         long stroke, i.e. a real gap left after both 2-unit strokes, not
         just edges meeting. The pair is centered on the circle. -->
    <g v-if="double" :style="filled ? { stroke: 'var(--bg)' } : undefined">
      <path d="M6.5 10.5l2 2 4-4" />
      <path d="M11.5 13.5l2 2 4-4" />
    </g>
    <path v-else :style="filled ? { stroke: 'var(--bg)' } : undefined" d="m9 12 2 2 4-4" />
  </svg>
</template>

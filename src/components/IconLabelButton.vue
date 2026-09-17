<script setup lang="ts">
import type { Component } from 'vue'

// Plain circle (fixed size, never re-centers/moves) + a label that unrolls
// left-to-right on hover, rather than the circle itself stretching into a
// pill. Extracted from Current.vue's own "add todos" plan-ahead button so
// Calendar.vue's day-detail Add/Edit buttons can reuse the exact same look
// instead of a second, drifting copy of the same CSS.
//
// `compact` swaps that side-unroll for a smaller circle with its label
// floated (position:absolute) below on hover instead — used wherever two of
// these sit close together (Calendar's day-detail Add+Edit) and a
// sideways-growing label would shove its neighbor sideways.
withDefaults(defineProps<{
  icon: Component
  label: string
  title?: string
  compact?: boolean
  circleSize?: number
  iconSize?: number
}>(), {
  iconSize: 12,
})
</script>

<template>
  <button
    type="button"
    class="icon-label-btn"
    :class="{ 'icon-label-btn--compact': compact }"
    :title="title"
  >
    <span
      class="icon-label-btn-icon"
      :style="circleSize ? { width: `${circleSize}px`, height: `${circleSize}px` } : undefined"
    >
      <component :is="icon" :size="iconSize" />
    </span>
    <span class="icon-label-btn-label">{{ label }}</span>
  </button>
</template>

<style scoped>
.icon-label-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  color: var(--ink);
  cursor: pointer;
}

/* Same height as .tag-chip/.all-btn (see base.css's --chip-* vars). */
.icon-label-btn-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(2 * var(--chip-padding-v) + 2 * var(--chip-border-width) + var(--chip-font-size) * var(--chip-line-height));
  height: calc(2 * var(--chip-padding-v) + 2 * var(--chip-border-width) + var(--chip-font-size) * var(--chip-line-height));
  border: var(--chip-border-width) solid var(--ink);
  border-radius: 50%;
  color: var(--ink);
  opacity: 0.55;
  transition: opacity 0.1s;
}

/* Rolled up to nothing by default, unrolls left-to-right on hover — stays
   dim (opacity 0.5) rather than fully stepping forward. */
.icon-label-btn-label {
  display: inline-block;
  max-width: 0;
  overflow: hidden;
  white-space: nowrap;
  opacity: 0;
  font-size: 16px;
  font-weight: 600;
  font-family: var(--font-mono, monospace);
  transition: max-width 0.35s ease, opacity 0.2s ease;
}

@media (hover: hover) {
  .icon-label-btn:hover .icon-label-btn-icon {
    opacity: 0.9;
  }

  .icon-label-btn:hover .icon-label-btn-label {
    max-width: 120px;
    opacity: 0.5;
  }
}

/* Compact: label leaves the flex flow entirely (position:absolute) so it
   never pushes a neighboring button sideways — it just fades in centered
   below the circle instead of unrolling next to it. */
.icon-label-btn--compact {
  position: relative;
  gap: 0;
}

.icon-label-btn--compact .icon-label-btn-label {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 4px;
  max-width: none;
  width: max-content;
  font-size: 11px;
  pointer-events: none;
}

@media (hover: hover) {
  .icon-label-btn--compact:hover .icon-label-btn-label {
    max-width: none;
    opacity: 0.5;
  }
}
</style>

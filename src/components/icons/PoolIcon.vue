<script setup lang="ts">
import { useId } from 'vue'

withDefaults(defineProps<{ size?: number | string }>(), { size: 24 })

// Two clipPath ids need to be unique per instance — this icon renders twice
// at once (desktop + mobile nav), and duplicate SVG ids are invalid/unsafe
// to rely on across browsers.
const uid = useId()
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath :id="`${uid}-circle`">
        <circle cx="50" cy="50" r="44" />
      </clipPath>
      <clipPath :id="`${uid}-bottom-half`">
        <rect x="0" y="50" width="100" height="50" />
      </clipPath>
    </defs>

    <circle cx="50" cy="50" r="42" stroke="currentColor" stroke-width="8" stroke-linecap="round" />

    <g :clip-path="`url(#${uid}-circle)`">
      <g :clip-path="`url(#${uid}-bottom-half)`">
        <path d="M -10 56 C 0 50 10 62 20 56 C 30 50 40 62 50 56 C 60 50 70 62 80 56 C 90 50 100 62 110 56" stroke="currentColor" stroke-width="7" stroke-linecap="round" />
        <path d="M -10 68 C 0 62 10 74 20 68 C 30 62 40 74 50 68 C 60 62 70 74 80 68 C 90 62 100 74 110 68" stroke="currentColor" stroke-width="7" stroke-linecap="round" />
        <path d="M -10 80 C 0 74 10 86 20 80 C 30 74 40 86 50 80 C 60 74 70 86 80 80 C 90 74 100 86 110 80" stroke="currentColor" stroke-width="7" stroke-linecap="round" />
      </g>
    </g>
  </svg>
</template>

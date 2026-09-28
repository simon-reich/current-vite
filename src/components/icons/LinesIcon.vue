<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string }>(), { size: 24 })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="10" x2="14" y2="10" />
    <line x1="4" y1="14" x2="18" y2="14" />
    <line x1="4" y1="18" x2="11" y2="18" />
  </svg>
</template>

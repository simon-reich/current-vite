<script setup lang="ts">
import { computed } from 'vue'
import { useTodosStore } from '../stores/todos'
import { activeTagIds } from '../composables/useTagFilter'

// Overview's active tag filters (prio included — it's just another tag in
// activeTagIds), shown quietly above the todos they filter, a click on one
// drops it again. Same state as the sidebar/tag-panel chips, so removing
// one here un-highlights it there too.
const store = useTodosStore()
const activeTags = computed(() =>
  activeTagIds.value
    .map(id => store.tags.find(t => t.id === id))
    .filter(t => !!t)
)

function removeFilter(id: string) {
  activeTagIds.value = activeTagIds.value.filter(t => t !== id)
}
</script>

<template>
  <div v-if="activeTags.length" class="active-filters">
    <button
      v-for="tag in activeTags"
      :key="tag.id"
      class="tag-chip active-filter"
      v-tooltip="'remove filter'"
      @click="removeFilter(tag.id)"
    >
      {{ tag.label }}
    </button>
  </div>
</template>

<style scoped>
.active-filters {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.active-filter {
  border: none;
  background: none;
  font-family: inherit;
  cursor: pointer;
  opacity: 0.35;
  transition: opacity 0.12s, transform 0.15s;
}

.active-filter:hover {
  opacity: 0.9;
}
</style>

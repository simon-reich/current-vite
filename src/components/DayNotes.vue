<script setup lang="ts">
import { computed } from 'vue'
import { useNotesStore } from '../stores/notes'
import { canHover } from '../composables/useTooltip'

// The calendar's notes box for one day — its own component because
// Calendar.vue places it in different spots per layout (under the
// calendar, or last in the phone's scrolling stack). The box itself is
// styled there with the other board boxes.
const props = defineProps<{ dateStr: string }>()
// Escape: the calendar takes the focus back, so the arrow keys step
// through its days again right away.
const emit = defineEmits<{ leave: [] }>()

const notesStore = useNotesStore()

// Saved as you type, an emptied note is removed (see stores/notes.ts).
const note = computed({
  get: () => notesStore.noteOn(props.dateStr),
  set: (text: string) => notesStore.setNote(props.dateStr, text),
})
const placeholder = `${canHover() ? 'click' : 'tap'} here to add notes`
</script>

<template>
  <section class="board-box board-box--notes">
    <p class="board-box-label">notes</p>
    <textarea
      v-model="note"
      class="day-note"
      :placeholder="placeholder"
      spellcheck="false"
      @keydown.escape="emit('leave')"
    />
  </section>
</template>

<style scoped>
.day-note {
  flex: 1;
  min-height: 0;
  width: 100%;
  padding: 0;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--ink);
  font-family: var(--font-mono, monospace);
  font-size: var(--day-item-font-size);
  line-height: 1.5;
  scrollbar-width: none;
}

.day-note::-webkit-scrollbar {
  display: none;
}

.day-note::placeholder {
  color: var(--ink);
  opacity: 0.4;
}
</style>

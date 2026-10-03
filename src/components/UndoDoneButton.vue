<script setup lang="ts">
import { Undo2 } from '@lucide/vue'
import { useTodosStore } from '../stores/todos'
import { runLoopSchedule } from '../composables/useLoopSchedule'

// Undo for a Done todo — shared by the Calendar's day detail and its log
// view, so both offer the exact same action. Sends the todo back to the
// pool (see uncompleteTodo); a Date/loop todo that's due right now then
// rejoins Current right away instead of waiting for the next schedule run.
const props = defineProps<{ todoId: string }>()
const store = useTodosStore()

function undo() {
  store.uncompleteTodo(props.todoId)
  runLoopSchedule(store)
}
</script>

<template>
  <button type="button" class="icon-circle-btn undo-done-btn" title="Undo done" @click.stop="undo">
    <Undo2 :size="10" />
  </button>
</template>

<style scoped>
/* Lines up with the first line of the 20px day-item title next to it. */
.undo-done-btn {
  margin-top: 5px;
}
</style>

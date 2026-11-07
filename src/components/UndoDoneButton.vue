<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { Undo2 } from '@lucide/vue'
import { useTodosStore } from '../stores/todos'
import { localDayOf } from '../composables/useToday'
import { runLoopSchedule } from '../composables/useLoopSchedule'
import { activeModal, releaseModalGuard } from '../composables/useModalGuard'

// Undo for a Done todo — shared by the Calendar's day detail and its log
// view, so both offer the exact same action. Sends the todo back to the
// pool (see uncompleteTodo); a Date/loop todo that's due right now then
// rejoins Current right away instead of waiting for the next schedule run.
// Asks first (same confirm modal as the delete confirmations) — a single
// click on a small icon was too easy to hit by accident.
//
// `worked` (with dateStr): the same button for a day's "worked on" entry
// instead — takes that day's Done for now and ticked subs back (see
// undoWorkedOn), the todo itself stays wherever it is now.
const props = defineProps<{ todoId: string; worked?: boolean; dateStr?: string }>()
const store = useTodosStore()

const confirming = ref(false)
const todo = computed(() => store.todos.find(t => t.id === props.todoId))
const title = computed(() => todo.value?.title ?? '')
// Subs that undoWorkedOn would untick too — mentioned in the confirm text.
const subsThatDay = computed(() => props.worked && props.dateStr
  ? (todo.value?.subs ?? []).filter(s => s.completedAt && localDayOf(s.completedAt) === props.dateStr).length
  : 0)

function cancel() {
  confirming.value = false
}

function undo() {
  confirming.value = false
  if (props.worked && props.dateStr) {
    store.undoWorkedOn(props.todoId, props.dateStr)
    return
  }
  store.uncompleteTodo(props.todoId)
  runLoopSchedule(store)
}

const guard = { onCancel: cancel, onConfirm: undo }
watch(confirming, (open) => {
  if (open) activeModal.value = guard
  else releaseModalGuard(guard)
})
onUnmounted(() => releaseModalGuard(guard))
</script>

<template>
  <button type="button" class="icon-circle-btn undo-done-btn" v-tooltip="worked ? 'undo done for now' : 'undo done'" @click.stop="confirming = true">
    <Undo2 :size="10" />
  </button>

  <!-- Teleported: the Calendar's entries sit inside transformed (animated)
       ancestors, which would otherwise become the containing block for
       the modal's position:fixed. -->
  <Teleport v-if="confirming" to="body">
    <div class="modal-backdrop" @click="cancel" />
    <div class="modal-box" role="dialog">
      <template v-if="worked">
        <p class="modal-text">remove <strong>{{ title }}</strong> from this day's done list?</p>
        <p v-if="subsThatDay" class="modal-text">this also unchecks all subs checked off that day.</p>
      </template>
      <p v-else class="modal-text">move <strong>{{ title }}</strong> back to the pool?</p>
      <div class="modal-actions">
        <button class="modal-btn modal-btn--cancel" @click="cancel">cancel</button>
        <button class="modal-btn modal-btn--save" @click="undo">undo</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* The one exception to .icon-circle-btn's pale default (base.css): full
   ink, no dimming — the only action on a done entry, it has to read as
   clickable. Hover steps to --ink-dark instead, since opacity can't go
   any higher. */
.undo-done-btn {
  opacity: 1;
}

@media (hover: hover) {
  .undo-done-btn:hover {
    opacity: 1;
    color: var(--ink-dark);
    border-color: var(--ink-dark);
  }
}
</style>

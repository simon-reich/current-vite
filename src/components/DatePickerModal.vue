<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { activeModal } from '../composables/useModalGuard'

// Extracted out of LoopPicker.vue's own inline date modal (see its git
// history) so the Focus Date widget can reuse the exact same "pick a day
// from a centered VCalendar modal" building block instead of a second
// implementation. Centered rather than an anchored popover for the same
// reason LoopPicker chose that originally — v-calendar's own popover isn't
// teleported and ends up clipped inside transformed/overflow:hidden
// ancestors (todo cards, the widget itself).
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  close: []
}>()

function close() {
  emit('close')
}

// No separate "confirm" action — clicking a day already applies and
// closes it. Enter/Escape (via activeModal below) just close.
function pickDate(day: { id: string }) {
  emit('update:modelValue', day.id)
  close()
}

onMounted(() => {
  activeModal.value = { onCancel: close, onConfirm: close }
})
onBeforeUnmount(() => {
  activeModal.value = null
})

const dateAttributes = computed(() => [{
  key: 'selected',
  highlight: {
    style: { backgroundColor: 'var(--ink-dark)', borderRadius: '4px' },
    contentStyle: { color: 'var(--bg)' },
  },
  dates: new Date(props.modelValue + 'T12:00:00'),
}])
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @mousedown.prevent @click="close" />
    <div class="modal-box" role="dialog" @mousedown.prevent @click.stop>
      <VCalendar :attributes="dateAttributes" expanded locale="en" @dayclick="pickDate" />
      <div class="modal-actions">
        <button class="modal-btn modal-btn--cancel" @click="close">Close</button>
      </div>
    </div>
  </Teleport>
</template>

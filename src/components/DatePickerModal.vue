<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { activeModal, type ModalGuard } from '../composables/useModalGuard'
import { todayStr, addDaysStr } from '../composables/useToday'
import { arrowKeyDayDelta } from '../composables/useCalendarKeys'

// Extracted out of LoopPicker.vue's own inline date modal (see its git
// history) so the Focus Date widget can reuse the exact same "pick a day
// from a centered VCalendar modal" building block instead of a second
// implementation. Centered rather than an anchored popover for the same
// reason LoopPicker chose that originally — v-calendar's own popover isn't
// teleported and ends up clipped inside transformed/overflow:hidden
// ancestors (todo cards, the widget itself).
//
// `disablePast`: FocusDateWidget's picker only ever targets a "plan ahead"
// date (see stores/todos.ts's assignFocusDate, which refuses a past date
// regardless), so past days are grayed out and unclickable there.
// LoopPicker's own "from" date picker leaves this off — a loop/once
// schedule can legitimately start in the past (see LoopPicker.vue).
const props = defineProps<{ modelValue: string; disablePast?: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  close: []
}>()

function close() {
  emit('close')
}

// No separate "confirm" action — clicking a day already applies and
// closes it. Arrow keys (desktop/tablet, via activeModal below) move a
// cursor through the grid the same way Calendar.vue's own arrows do
// (arrowKeyDayDelta) without applying yet — Enter applies the cursor's
// day and closes, Escape closes without changing anything.
const cursorDate = ref(props.modelValue)
const calendarRef = ref<any>(null)

function pickDate(day: { id: string }) {
  if (props.disablePast && day.id < todayStr()) return
  emit('update:modelValue', day.id)
  close()
}

function confirm() {
  if (cursorDate.value !== props.modelValue) emit('update:modelValue', cursorDate.value)
  close()
}

function onKeydown(e: KeyboardEvent) {
  const delta = arrowKeyDayDelta(e.key)
  if (delta === null) return
  e.preventDefault()
  let next = addDaysStr(cursorDate.value, delta)
  if (props.disablePast && next < todayStr()) next = todayStr()
  cursorDate.value = next
  calendarRef.value?.move(new Date(next + 'T12:00:00'))
}

// Deliberately not the shared registerModalGuard() helper (see its own
// comment) — this one has a real onConfirm (applies the arrow-key cursor,
// see confirm above) and onKeydown, and registers inside
// onMounted rather than at setup. It's also the one modal that can itself
// open while another modal is already up (LoopPicker's custom-date picker,
// reachable from inside CheckModal) — closing it has to hand control back
// to that parent modal, not just clear it, so it remembers whatever was
// active before it opened (null in the common, non-nested case, e.g.
// FocusDateWidget) and restores exactly that, guarded the same way
// registerModalGuard is against a third modal having since taken over.
let previousGuard: ModalGuard | null = null
onMounted(() => {
  previousGuard = activeModal.value
  activeModal.value = { onCancel: close, onConfirm: confirm, onKeydown }
})
onBeforeUnmount(() => {
  if (activeModal.value?.onCancel === close) activeModal.value = previousGuard
})

const dateAttributes = computed(() => [{
  key: 'selected',
  highlight: {
    style: { backgroundColor: 'var(--ink-dark)', borderRadius: '4px' },
    contentStyle: { color: 'var(--bg)' },
  },
  dates: new Date(cursorDate.value + 'T12:00:00'),
}])

const minDate = computed(() => props.disablePast ? new Date(todayStr() + 'T00:00:00') : undefined)
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @mousedown.prevent @click="close" />
    <div class="modal-box" role="dialog" @mousedown.prevent @click.stop>
      <VCalendar ref="calendarRef" :attributes="dateAttributes" :min-date="minDate" expanded locale="en" :first-day-of-week="2" @dayclick="pickDate" />
      <div class="modal-actions">
        <button class="modal-btn modal-btn--cancel" @click="close">close</button>
      </div>
    </div>
  </Teleport>
</template>

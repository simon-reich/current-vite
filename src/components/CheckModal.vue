<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useChecksStore, CHECK_TITLE_MAX_LENGTH, type Check, type CheckSchedule } from '../stores/checks'
import type { LoopInterval } from '../stores/todos'
import { registerModalGuard } from '../composables/useModalGuard'
import { todayStr } from '../composables/useToday'
import LoopPicker from './LoopPicker.vue'

const props = defineProps<{
  /** Absent → creating a new Check. Set → editing this one in place, and
   *  Delete becomes available. */
  editing?: Check
}>()

const emit = defineEmits<{ close: [] }>()

const store = useChecksStore()

const title = ref(props.editing?.title ?? '')
const schedule = ref<CheckSchedule>(
  props.editing?.schedule ?? { unit: 'day', count: 1, startDate: todayStr() },
)
const titleInputRef = ref<HTMLInputElement | null>(null)

const canSave = computed(() => title.value.trim().length > 0)

// LoopPicker speaks the wider LoopInterval (it always carries a `mode`,
// which Checks have no use for — see CheckSchedule's own comment in
// stores/checks.ts) — bridge the two directions here rather than teaching
// LoopPicker about Checks.
const pickerValue = computed<LoopInterval>(() => ({ mode: 'loop', ...schedule.value }))
function updateSchedule(interval: LoopInterval) {
  schedule.value = { unit: interval.unit ?? 'day', count: interval.count, weekdays: interval.weekdays, startDate: interval.startDate }
}

function save() {
  if (!canSave.value) return
  if (props.editing) store.updateCheck(props.editing.id, { title: title.value, schedule: schedule.value })
  else store.addCheck(title.value, schedule.value)
  emit('close')
}

function remove() {
  if (!props.editing) return
  store.deleteCheck(props.editing.id)
  emit('close')
}

function close() {
  emit('close')
}

// Registers with the same app-wide modal guard the delete-confirm and
// LoopPicker's own date-modal use — App.vue's single global keydown
// listener then makes Escape cancel / Enter confirm here too, and blocks
// every other shortcut underneath while this is up.
registerModalGuard({ onCancel: close, onConfirm: save })

nextTick(() => titleInputRef.value?.focus())
</script>

<template>
  <div class="modal-backdrop" @click="close" />
  <div class="modal-box check-modal-box" role="dialog" @click.stop>
    <input
      ref="titleInputRef"
      v-model="title"
      type="text"
      class="check-title-input"
      placeholder="check name"
      :maxlength="CHECK_TITLE_MAX_LENGTH"
      @keydown.enter="save"
    />
    <LoopPicker :model-value="pickerValue" :allow-once="false" :allow-reschedule="false" @update:model-value="updateSchedule" />
    <div class="modal-actions">
      <button v-if="editing" class="modal-btn modal-btn--pale" @click="remove">delete</button>
      <button class="modal-btn modal-btn--cancel" @click="close">cancel</button>
      <button class="modal-btn modal-btn--save" :disabled="!canSave" @click="save">save</button>
    </div>
  </div>
</template>

<style scoped>
.check-modal-box {
  width: 320px;
}

/* Wide enough that LoopPicker's 4 preset buttons (daily/weekly/monthly/
   yearly, 74px each) and its weekdays row (74px toggle + 7 34px day
   buttons — the widest row, ~382px of content) both fit on one line
   instead of wrapping — overrides .modal-box's own 380px max-width (see
   layout.css), which would otherwise clamp this back down regardless of
   the width set here. Phones stay at the narrower default above; there's
   no comfortable way to fit either row on one line at phone widths, and
   wrapping there is expected/fine. */
@media (min-width: 701px) {
  .check-modal-box {
    width: 460px;
    max-width: 460px;
  }
}

/* On phones, .modal-box's default vertical centering (see layout.css)
   puts this modal right where the on-screen keyboard shows up once the
   title input is focused — keyboard and modal fight over the same
   vertical space. Pinning it near the very top instead keeps it clear of
   the keyboard entirely, same place a Todo card lands via
   scrollCardIntoView's block:'start' when its own editor opens. Desktop/
   tablet have no on-screen keyboard to dodge, so they keep the shared
   centered layout. */
@media (max-width: 700px) {
  .check-modal-box {
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
  }
}

.check-title-input {
  width: 100%;
  background: none;
  border: none;
  border-bottom: 2px solid var(--ink);
  color: var(--ink);
  font-family: var(--font-mono, monospace);
  font-size: 16px;
  font-weight: 700;
  padding: 4px 2px 8px;
  outline: none;
}

.check-title-input::placeholder {
  color: var(--ink);
  opacity: 0.4;
}
</style>

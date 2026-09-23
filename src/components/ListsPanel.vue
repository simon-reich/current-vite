<script setup lang="ts">
import { computed } from 'vue'
import { Trash2 } from '@lucide/vue'
import { useTodosStore } from '../stores/todos'
import { registerModalGuard } from '../composables/useModalGuard'
import { todayStr } from '../composables/useToday'

// Pure picker/deleter for Date Lists — picking a row swaps Current.vue's
// whole view over to that list (see its viewingDate), rather than
// previewing it here in a cramped modal. Reached from Current.vue's "Lists"
// button (desktop) or the tablet/phone triggers in App.vue.
const props = defineProps<{ viewingDate: string | null }>()
const emit = defineEmits<{ select: [dateStr: string | null]; close: [] }>()

const store = useTodosStore()

const allDates = computed(() => {
  const today = todayStr()
  return store.datesWithFocusList.map(d => ({ date: d, count: store.todosForFocusDate(d).length, isToday: d === today }))
})

function select(dateStr: string | null) {
  emit('select', dateStr)
}

function deleteList(dateStr: string) {
  store.deleteFocusDateList(dateStr)
  // No day-agnostic pool to fall back to any more (see Current.vue's
  // dateListCycle) — land on today's list instead of null.
  if (props.viewingDate === dateStr) select(todayStr())
}

function close() {
  emit('close')
}

// Same app-wide modal guard every other overlay uses — Escape closes this,
// no single primary Enter action (picking a row already applies and
// closes it, mirroring DatePickerModal's own dayclick).
registerModalGuard({ onCancel: close })
</script>

<template>
  <div class="modal-backdrop" @click="close" />
  <div class="modal-box lists-panel-box" role="dialog" @click.stop>
    <h2 class="lists-panel-title">lists</h2>
    <div class="lists-panel-list">
      <div v-for="entry in allDates" :key="entry.date" class="lists-panel-row">
        <button
          type="button"
          class="lists-panel-row-main"
          :class="{ active: viewingDate === entry.date }"
          @click="select(entry.date)"
        >
          <span class="lists-panel-row-date">{{ entry.isToday ? 'Today' : entry.date }}</span>
          <span class="lists-panel-row-count">{{ entry.count }}</span>
        </button>
        <button type="button" class="lists-panel-row-delete" title="Delete list" @click="deleteList(entry.date)">
          <Trash2 :size="14" />
        </button>
      </div>
    </div>
    <p v-if="!allDates.length" class="lists-panel-empty">No upcoming lists planned yet.</p>

    <div class="modal-actions">
      <button class="modal-btn modal-btn--cancel" @click="close">close</button>
    </div>
  </div>
</template>

<style scoped>
.lists-panel-box {
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

@media (min-width: 701px) {
  .lists-panel-box {
    width: 380px;
  }
}

@media (max-width: 700px) {
  .lists-panel-box {
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
  }
}

.lists-panel-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--ink-dark);
  font-family: var(--font-mono, monospace);
}

.lists-panel-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 50vh;
  overflow-y: auto;
  scrollbar-width: none;
}

.lists-panel-list::-webkit-scrollbar {
  display: none;
}

.lists-panel-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lists-panel-row-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: none;
  border: none;
  padding: 6px 2px;
  color: var(--ink);
  font-family: var(--font-mono, monospace);
  font-size: 15px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.1s;
}

.lists-panel-row-main.active {
  opacity: 1;
  color: var(--ink-dark);
}

@media (hover: hover) {
  .lists-panel-row-main:hover {
    opacity: 1;
  }
}

.lists-panel-row-count {
  opacity: 0.5;
  font-size: 13px;
}

.lists-panel-row-delete {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--ink);
  opacity: 0.4;
  cursor: pointer;
  padding: 4px;
  transition: opacity 0.1s;
}

@media (hover: hover) {
  .lists-panel-row-delete:hover {
    opacity: 1;
  }
}

.lists-panel-empty {
  font-size: 14px;
  color: var(--ink);
  opacity: 0.6;
}
</style>

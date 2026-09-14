<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { Trash2, ChevronLeft } from '@lucide/vue'
import { useTodosStore } from '../stores/todos'
import { activeModal } from '../composables/useModalGuard'
import TodoCard from './TodoCard.vue'
import { assignFonts } from '../composables/useTodoFonts'

// Browses every Date List that isn't the plain pool — today's own (if one
// exists) plus every future one (see stores/todos.ts's futureFocusDates/
// todosForFocusDate). Reached from Focus.vue's "Lists" button (desktop) or
// the tablet/phone triggers in App.vue (see listsPanelOpen, provided from
// App.vue and injected here would be redundant — this component is only
// ever rendered while open, so a plain `close` emit is enough).
const emit = defineEmits<{ close: [] }>()

const store = useTodosStore()

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

const allDates = computed(() => {
  const today = todayStr()
  const dates = store.hasFocusDateList(today) ? [today, ...store.futureFocusDates] : store.futureFocusDates
  return dates.map(d => ({ date: d, count: store.todosForFocusDate(d).length, isToday: d === today }))
})

const selectedDate = ref<string | null>(null)

const previewTodos = computed(() => selectedDate.value ? store.todosForFocusDate(selectedDate.value) : [])
const fontMap = computed(() => assignFonts(previewTodos.value.map(t => t.id)))
const siblingIds = computed(() => previewTodos.value.map(t => t.id))

function openDate(dateStr: string) {
  selectedDate.value = dateStr
}

function backToList() {
  selectedDate.value = null
}

function deleteList(dateStr: string) {
  store.deleteFocusDateList(dateStr)
  if (selectedDate.value === dateStr) selectedDate.value = null
}

function removeFromPreview(id: string) {
  if (selectedDate.value) store.unassignFocusDate(id, selectedDate.value)
}

function close() {
  emit('close')
}

// Same app-wide modal guard every other overlay uses — Escape closes this
// (or steps back to the list from a date's preview), no single primary
// Enter action.
activeModal.value = { onCancel: () => { if (selectedDate.value) backToList(); else close() } }
onUnmounted(() => {
  if (activeModal.value?.onCancel) activeModal.value = null
})
</script>

<template>
  <div class="modal-backdrop" @click="close" />
  <div class="modal-box lists-panel-box" role="dialog" @click.stop>
    <template v-if="!selectedDate">
      <h2 class="lists-panel-title">lists</h2>
      <div v-if="allDates.length" class="lists-panel-list">
        <div v-for="entry in allDates" :key="entry.date" class="lists-panel-row">
          <button type="button" class="lists-panel-row-main" @click="openDate(entry.date)">
            <span class="lists-panel-row-date">{{ entry.isToday ? 'Today' : entry.date }}</span>
            <span class="lists-panel-row-count">{{ entry.count }}</span>
          </button>
          <button type="button" class="lists-panel-row-delete" title="Delete list" @click="deleteList(entry.date)">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
      <p v-else class="lists-panel-empty">No upcoming lists planned yet.</p>

      <div class="modal-actions">
        <button class="modal-btn modal-btn--cancel" @click="close">close</button>
      </div>
    </template>

    <template v-else>
      <div class="lists-panel-detail-head">
        <button type="button" class="lists-panel-back" title="Back to lists" @click="backToList">
          <ChevronLeft :size="18" />
        </button>
        <h2 class="lists-panel-title">{{ selectedDate === todayStr() ? 'Today' : selectedDate }}</h2>
      </div>
      <p v-if="selectedDate !== todayStr()" class="lists-panel-hint">
        Preview only — Done/Done-for-today unlock once this day arrives.
      </p>
      <div v-if="previewTodos.length" class="lists-panel-preview">
        <TodoCard
          v-for="(todo, index) in previewTodos"
          :key="todo.id"
          :todo="todo"
          :font="fontMap.get(todo.id)"
          :sibling-ids="siblingIds"
          :index="index"
          mode="today"
          :preview-locked="selectedDate !== todayStr()"
          @remove-from-today="removeFromPreview"
          @complete="store.completeTodo($event)"
          @done-for-today="store.doneForToday($event)"
          @delete="store.deleteTodo($event)"
        />
      </div>
      <p v-else class="lists-panel-empty">Nothing planned for this day.</p>

      <div class="modal-actions">
        <button class="modal-btn modal-btn--cancel" @click="close">close</button>
      </div>
    </template>
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
    width: 420px;
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

.lists-panel-detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lists-panel-back {
  background: none;
  border: none;
  color: var(--ink);
  cursor: pointer;
  padding: 2px;
}

.lists-panel-hint {
  font-size: 12px;
  color: var(--ink);
  opacity: 0.55;
  font-family: var(--font-mono, monospace);
}

.lists-panel-preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 50vh;
  overflow-y: auto;
  scrollbar-width: none;
}

.lists-panel-preview::-webkit-scrollbar {
  display: none;
}
</style>

<script setup lang="ts">
// Last element of a tag picker row (.tag-row / .add-tag-row /
// .add-sheet-tag-list) — a circle "+" that, on click, turns into an empty
// tag pill you type directly into (not a separate input box next to it,
// see .tag-row-add-field below). Enter commits via store.addTag and tells
// the parent to select it; Escape (or blur) discards and reverts to the
// circle. One shared implementation for App.vue's add-todo tag row (both
// desktop dropdown and mobile sheet) and TodoCard.vue's edit-todo tag
// menu, instead of three separate copies of this behavior.
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { Plus } from '@lucide/vue'
import { useTodosStore, type Tag } from '../stores/todos'

const store = useTodosStore()
const emit = defineEmits<{ created: [tag: Tag], 'focus-inside': [] }>()

const editing = ref(false)
const draft = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const btnRef = ref<HTMLButtonElement | null>(null)

// Sizes the idle "+" circle to match a real tag pill's own rendered
// height instead of a guessed CSS formula (see .tag-row-add-btn's own
// comment in layout.css for why) — measured off whatever .tag-row-opt
// pill happens to be next to this button (the pinned prio/date tags are
// always present, so there's always one to measure against), and kept in
// sync via ResizeObserver for font-size/breakpoint changes.
let resizeObserver: ResizeObserver | null = null
let observedSibling: Element | null = null

function measureSize() {
  const container = btnRef.value?.parentElement
  const sibling = container?.querySelector('.tag-row-opt:not(.tag-row-add-editing)') as HTMLElement | null
  if (!sibling) return
  btnRef.value?.style.setProperty('--tag-row-add-size', `${sibling.getBoundingClientRect().height}px`)
  if (sibling !== observedSibling) {
    if (observedSibling) resizeObserver?.unobserve(observedSibling)
    resizeObserver?.observe(sibling)
    observedSibling = sibling
  }
}

onMounted(() => {
  resizeObserver = new ResizeObserver(measureSize)
  nextTick(measureSize)
})

onUnmounted(() => resizeObserver?.disconnect())

// The button unmounts while editing (v-if swaps to the input) and comes
// back as a fresh DOM node without the inline --tag-row-add-size the old
// one had — re-measure and reapply once it's back.
watch(editing, (isEditing) => {
  if (!isEditing) nextTick(measureSize)
})

function startCreate() {
  editing.value = true
  draft.value = ''
  nextTick(() => inputRef.value?.focus())
}

function cancel() {
  editing.value = false
  draft.value = ''
}

function commit() {
  const label = draft.value.trim()
  if (!label) { cancel(); return }
  // Same "don't duplicate" rule as the sidebar's bulk tag input
  // (handleTagKey in App.vue) — reuse the existing tag instead of making a
  // second one with the same label.
  const existing = store.tags.find(t => t.label.toLowerCase() === label.toLowerCase())
  const tag = existing ?? store.addTag(label)
  editing.value = false
  draft.value = ''
  emit('created', tag)
}

// Every key here must stay local to typing the tag label — without this,
// letters like D/S/G bubble up to the document-level shortcut listeners
// (App.vue's onGlobalKeydown, TodoCard.vue's onCardKeydown) and fire
// delete/sort/etc. while the label is only used for its Enter/Escape
// branches, everything else just needs to type normally into the field.
function onKeydown(e: KeyboardEvent) {
  e.stopPropagation()
  if (e.key === 'Enter') { e.preventDefault(); commit() }
  else if (e.key === 'Escape') { e.preventDefault(); cancel() }
}
</script>

<template>
  <button v-if="!editing" ref="btnRef" type="button" class="tag-row-add-btn" title="New tag" @mousedown.prevent="startCreate">
    <Plus :size="12" />
  </button>
  <span v-else class="tag-row-opt tag-row-add-editing" @mousedown.stop @click.stop>
    <input
      ref="inputRef"
      v-model="draft"
      class="tag-row-add-field"
      :size="Math.max(1, draft.length)"
      @focus="emit('focus-inside')"
      @keydown="onKeydown"
      @blur="cancel"
    />
  </span>
</template>

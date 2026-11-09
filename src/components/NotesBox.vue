<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useNotesStore, NOTE_MAX_LENGTH } from '../stores/notes'
import { canHover } from '../composables/useTooltip'
import { Check } from '@lucide/vue'

// The notes of the list you're looking at — label, done tick, the text —
// wherever a view shows them: a day's (dateStr) in Calendar's journal
// (under the calendar, or last in the phone's scrolling stack; there it
// also wears the board-box frame, passed in as a class) and in Current
// with Date Lists; Current's own list note without them (dateStr null —
// see stores/notes.ts), labelled "current notes" since it's Current's own,
// not a day's. Same look everywhere.
// autoGrow: the field grows with its text instead of scrolling inside
// itself — wherever the notes sit in a scrolling stack anyway (Current;
// Calendar on the phone), so there's only the one scroll. Otherwise it
// fills its box and scrolls on its own.
const props = defineProps<{ dateStr: string | null; autoGrow?: boolean }>()
// Leaving the field (Escape, the done tick): it blurs itself; the view
// can take the focus on from there (Calendar: back to its days, so the
// arrow keys step through them again right away).
const emit = defineEmits<{ leave: [] }>()

const notesStore = useNotesStore()

// Saved as you type, an emptied note is removed (see stores/notes.ts).
const note = computed({
  get: () => props.dateStr === null ? notesStore.listNote : notesStore.noteOn(props.dateStr),
  set: (text: string) => props.dateStr === null ? notesStore.setListNote(text) : notesStore.setNote(props.dateStr, text),
})
const placeholder = `${canHover() ? 'click' : 'tap'} here to add notes`

const fieldRef = ref<HTMLTextAreaElement | null>(null)
function fitHeight() {
  const el = fieldRef.value
  if (!el) return
  el.style.height = ''
  if (props.autoGrow) el.style.height = `${el.scrollHeight}px`
}
watch([note, () => props.autoGrow], () => nextTick(fitHeight))
onMounted(fitHeight)

function leave() {
  fieldRef.value?.blur()
  emit('leave')
}

// While typing, a tick in the box's head offers a way out by click/tap —
// on the phone there's otherwise no obvious one. Same as Escape (see
// leave; blurring also closes a phone's keyboard).
// Always in the layout, only shown while focused, so the head never
// changes height. pointerdown.prevent keeps the field focused until the
// click lands — otherwise the blur would hide the button first.
const focused = ref(false)

// Nearing the cap (NOTE_MAX_LENGTH, stores/notes.ts): from 90% on, a small
// "used / cap" hint right under the line being typed in, starting at the
// caret (the room kept below the notes — --main-bottom-gap, App.vue — keeps
// it clear of the screen's edge at the text's end). Where the caret is
// gets measured off an invisible copy of the field (mirrorRef: same
// width, font and wrapping), filled with the text up to the caret and a
// marker at its end.
const LIMIT_HINT_FROM = 0.9
const showLimitHint = computed(() => focused.value && note.value.length >= NOTE_MAX_LENGTH * LIMIT_HINT_FROM)
const limitHint = computed(() => `${note.value.length} / ${NOTE_MAX_LENGTH}`)
const mirrorRef = ref<HTMLElement | null>(null)
const hintRef = ref<HTMLElement | null>(null)
const hintPos = ref({ top: 0, left: 0 })
function placeLimitHint() {
  const field = fieldRef.value
  const mirror = mirrorRef.value
  if (!field || !mirror || !showLimitHint.value) return
  mirror.style.width = `${field.clientWidth}px`
  mirror.textContent = field.value.slice(0, field.selectionStart ?? field.value.length)
  const marker = document.createElement('span')
  marker.textContent = '​'
  mirror.appendChild(marker)
  const cs = getComputedStyle(field)
  const fontSize = parseFloat(cs.fontSize) || 16
  const lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.5
  const hintWidth = hintRef.value?.offsetWidth ?? 0
  hintPos.value = {
    // Right under the line's text, not under its whole line box — the
    // line height's extra room (split above and below the text) left out.
    top: field.offsetTop + marker.offsetTop - field.scrollTop + lineHeight - (lineHeight - fontSize) / 2,
    // Starts at the caret, but stays inside the field's width.
    left: field.offsetLeft + Math.max(0, Math.min(marker.offsetLeft, field.clientWidth - hintWidth)),
  }
}
watch(showLimitHint, () => nextTick(placeLimitHint))
</script>

<template>
  <section class="day-notes">
    <div class="board-box-head">
      <p class="board-box-label">{{ dateStr === null ? 'current notes' : 'notes' }}</p>
      <button
        type="button"
        class="icon-circle-btn note-done-btn"
        :class="{ visible: focused }"
        :tabindex="focused ? 0 : -1"
        v-tooltip="'done'"
        @pointerdown.prevent
        @click="leave"
      >
        <Check :size="10" />
      </button>
    </div>
    <div class="note-field" :class="{ 'note-field--grow': autoGrow }">
      <textarea
        ref="fieldRef"
        v-model="note"
        class="day-note"
        :class="{ 'day-note--grow': autoGrow }"
        :placeholder="placeholder"
        :maxlength="NOTE_MAX_LENGTH"
        spellcheck="false"
        @focus="focused = true"
        @blur="focused = false"
        @keydown.escape="leave"
        @input="nextTick(placeLimitHint)"
        @keyup="placeLimitHint"
        @click="placeLimitHint"
        @scroll="placeLimitHint"
      />
      <div ref="mirrorRef" class="day-note day-note-mirror" aria-hidden="true" />
      <div
        v-if="showLimitHint"
        ref="hintRef"
        class="note-limit-hint"
        :style="{ top: `${hintPos.top}px`, left: `${hintPos.left}px` }"
      ><span class="board-box-label">{{ limitHint }}</span></div>
    </div>
  </section>
</template>

<style scoped>
.day-notes {
  display: flex;
  flex-direction: column;
  gap: var(--board-box-gap);
}

/* Holds the field plus what's measured and shown against it (the caret
   mirror, the limit hint). Takes the field's place in the box: fills it,
   or (autoGrow) just wraps the growing field. */
.note-field {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.note-field--grow {
  flex: none;
}

/* The entries' size where there is one (Calendar's --day-item-font-size),
   else the same 16px. */
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
  font-size: var(--day-item-font-size, 16px);
  line-height: 1.5;
  scrollbar-width: none;
}

.day-note::-webkit-scrollbar {
  display: none;
}

/* autoGrow: grows with its text (see fitHeight), never scrolls itself. */
.day-note--grow {
  flex: none;
  overflow: hidden;
}

/* The caret mirror: the field's own text styles (.day-note), wrapping like
   a textarea does, out of sight and out of the way. */
.day-note-mirror {
  position: absolute;
  top: 0;
  left: 0;
  visibility: hidden;
  pointer-events: none;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  height: auto;
}

/* Under the caret's line, in the box labels' look (small pale mono), on
   an opaque --bg patch so it stays legible over the text below it — the
   patch here, the label's own paleness only on the text inside. */
.note-limit-hint {
  position: absolute;
  z-index: 1;
  padding: 0 4px;
  background: var(--bg);
  white-space: nowrap;
  pointer-events: none;
}

.note-done-btn:not(.visible) {
  opacity: 0;
  pointer-events: none;
}

/* Italic like the boxes' empty-state texts (Calendar.vue's .no-activity). */
.day-note::placeholder {
  color: var(--ink);
  opacity: 0.4;
  font-style: italic;
}
</style>

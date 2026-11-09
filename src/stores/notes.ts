import { defineStore } from 'pinia'
import { ref } from 'vue'

// Notes belong to the list you're looking at (NotesBox.vue):
// - notes: a free-text note per day — a Date List is a day, and Calendar's
//   journal is per day too, so both show the same one. Keyed by ISO date
//   (YYYY-MM-DD); only days that actually have a note get an entry —
//   clearing the text removes it again, so empty days cost nothing.
// - listNote: Current's own note while Date Lists are off — that list has
//   no day, it just carries on, and so does its note (upcoming stuff, things
//   to keep in view) until you change it. Belongs to no day, so it never
//   shows in the calendar. Kept while Date Lists are on, back when they're
//   off again.
// Generous (about two pages), but a cap: everything shares localStorage's
// ~5 MB, and once that's full saving fails — not just for notes, possibly
// for todos changed afterwards too. Typing won't get there, pasting
// something huge by accident could. Enforced here (imports included) and
// as the field's maxlength (NotesBox.vue).
export const NOTE_MAX_LENGTH = 5000

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<Record<string, string>>({})
  const listNote = ref('')

  function noteOn(dateStr: string): string {
    return notes.value[dateStr] ?? ''
  }

  function setNote(dateStr: string, text: string) {
    if (text.trim()) notes.value[dateStr] = text.slice(0, NOTE_MAX_LENGTH)
    else delete notes.value[dateStr]
  }

  function setListNote(text: string) {
    listNote.value = text.trim() ? text.slice(0, NOTE_MAX_LENGTH) : ''
  }

  // Replaces, doesn't merge — same semantics as importChecks.
  function importNotes(data: Record<string, string>) {
    notes.value = Object.fromEntries(Object.entries(data).map(([day, text]) => [day, text.slice(0, NOTE_MAX_LENGTH)]))
  }

  return { notes, listNote, noteOn, setNote, setListNote, importNotes }
}, {
  persist: true,
})

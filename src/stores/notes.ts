import { defineStore } from 'pinia'
import { ref } from 'vue'

// A free-text note per day, written in the calendar's notes box. Keyed by
// ISO date (YYYY-MM-DD); only days that actually have a note get an entry —
// clearing the text removes it again, so empty days cost nothing.
export const useNotesStore = defineStore('notes', () => {
  const notes = ref<Record<string, string>>({})

  function noteOn(dateStr: string): string {
    return notes.value[dateStr] ?? ''
  }

  function setNote(dateStr: string, text: string) {
    if (text.trim()) notes.value[dateStr] = text
    else delete notes.value[dateStr]
  }

  // Replaces, doesn't merge — same semantics as importChecks.
  function importNotes(data: Record<string, string>) {
    notes.value = data
  }

  return { notes, noteOn, setNote, importNotes }
}, {
  persist: true,
})

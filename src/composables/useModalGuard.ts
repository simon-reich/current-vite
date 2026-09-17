import { ref, onUnmounted } from 'vue'

export interface ModalGuard {
  onCancel: () => void
  onConfirm?: () => void
}

// Whichever confirmation modal is currently open (delete-todo, delete-tag,
// loop's start-date picker, ...) registers itself here. A single source of
// truth lets App.vue's one global keydown listener enforce one rule for
// all of them: Escape always cancels, Enter always confirms, and nothing
// else (view/card cycling, single-letter shortcuts, a card's own
// Escape/Enter handling) gets through underneath while a modal is up.
export const activeModal = ref<ModalGuard | null>(null)

// Registers `guard` as the active modal for the lifetime of the calling
// component, and clears it again on unmount — but only if nothing else has
// taken over in the meantime (a second modal opened before this one
// closed), so this can't clobber a still-open modal's own guard. Covers
// the common "register once at setup, no separate confirm step, never
// nested under another modal" case used by ListsPanel/CheckModal/
// AllChecksModal. DatePickerModal.vue is the one exception and keeps its
// own bespoke wiring — it's the one modal that CAN open while another is
// already up (LoopPicker's custom-date picker, reachable from inside
// CheckModal), so on close it has to restore whatever was active before
// it opened rather than just clearing to null — see its own comment.
export function registerModalGuard(guard: ModalGuard) {
  activeModal.value = guard
  onUnmounted(() => {
    if (activeModal.value?.onCancel === guard.onCancel) activeModal.value = null
  })
}

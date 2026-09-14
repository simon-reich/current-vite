import { ref } from 'vue'

export interface Toast {
  id: number
  label: string
  left: string
  top: string
  dupTag?: boolean
}

// Shared across every caller (App.vue's own duplicate-tag/auto-focus
// toasts, AllTodos.vue's send-to-Focus toast, ...) so there's one render
// list and one overlay in App.vue's template, regardless of which view
// actually triggered a toast.
export const toasts = ref<Toast[]>([])

let toastIdCounter = 0

// left/top are viewport-fixed CSS values (px or %) — the toast's own
// translateX(-50%) keyframe (see toast-float in layout.css) centers it
// horizontally around whatever `left` is given, so callers just pass an
// anchor point.
// dupTag: the duplicate-tag toast anchors to the desktop sidebar's tag
// input, which doesn't exist on mobile — mobile.css force-centers just
// that one via this flag, without touching a card-anchored toast's own
// position (that one stays valid on mobile too, it just points at a card).
export function spawnToast(label: string, left: string, top: string, dupTag = false) {
  const id = ++toastIdCounter
  toasts.value.push({ id, label, left, top, dupTag })
  setTimeout(() => {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }, 1400)
}

// Shared by every trigger that moves a card between Overview and Focus (a
// due loop todo added while away from Focus, Enter/"+"/swipe on an
// Overview card, D/CircleMinus/swipe-left on a Focus card, ...) — measures
// the card's own on-screen position right before it's moved so the toast
// visibly rises from wherever the card actually was, instead of a generic
// center-screen bubble with no spatial link to what just happened.
function spawnCardMoveToast(todoId: string, label: string) {
  const cardEl = document.querySelector<HTMLElement>(`[data-todo-id="${todoId}"]`)
  const rect = cardEl?.getBoundingClientRect()
  spawnToast(
    label,
    rect ? `${rect.left + rect.width / 2}px` : '50%',
    rect ? `${rect.top}px` : '20vh',
  )
}

export function spawnSentToFocusToast(todoId: string) {
  spawnCardMoveToast(todoId, 'sent to Focus')
}

export function spawnRemovedFromFocusToast(todoId: string) {
  spawnCardMoveToast(todoId, 'removed from Focus')
}

// The card doesn't move anywhere (see stores/todos.ts's assignFocusDate) —
// same "rises from the card's own position" idea as the other two above,
// just labeled with the target date instead of "Focus".
export function spawnPlannedForDateToast(todoId: string, dateStr: string) {
  const [, m, d] = dateStr.split('-')
  spawnCardMoveToast(todoId, `planned for ${d}/${m}`)
}

import { ref } from 'vue'

export interface Toast {
  id: number
  label: string
  left: string
  top: string
  dupTag?: boolean
}

// Shared across every caller so there's one render list and one overlay in
// App.vue's template, regardless of where a toast was triggered. Currently
// only App.vue's duplicate-tag toast uses it.
export const toasts = ref<Toast[]>([])

let toastIdCounter = 0

// left/top are viewport-fixed CSS values (px or %) — the toast's own
// translateX(-50%) keyframe (see toast-float in layout.css) centers it
// horizontally around whatever `left` is given, so callers just pass an
// anchor point.
// dupTag: on phones mobile.css force-centers the duplicate-tag toast below
// the mobile tag panel's head via this flag, instead of using the anchor.
export function spawnToast(label: string, left: string, top: string, dupTag = false) {
  const id = ++toastIdCounter
  toasts.value.push({ id, label, left, top, dupTag })
  setTimeout(() => {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }, 1400)
}

import { ref } from 'vue'

// A frame counter the coach bumps on every animation frame while the tour
// runs (TutorialCoach.vue's track loop) — reading it makes a step's done()/
// ready() re-check plain DOM state (an open picker, an active option) that
// isn't reactive on its own.
export const frame = ref(0)

export function domFind(selector: string): HTMLElement | null {
  void frame.value
  return document.querySelector<HTMLElement>(selector)
}

// The first element matching `selector` whose text is exactly `text`.
export function domFindByText(selector: string, text: string): HTMLElement | null {
  void frame.value
  return [...document.querySelectorAll<HTMLElement>(selector)].find(el => el.textContent?.trim() === text) ?? null
}

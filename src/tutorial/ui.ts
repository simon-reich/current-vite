import { useTodosStore } from '../stores/todos'
import { requestTodoDraft } from '../composables/useTodoDraftRequest'

// Small nudges at the app's own UI from tutorial steps, without the app
// knowing about the tutorial — they go through the same events/requests a
// user (or another part of the app) would cause, so App.vue's own handling
// stays the single source of truth.

// The add-todo field: the desktop/tablet input with its dropdown, or the
// phone add sheet.
export const ADD_FIELD = '.add-wrapper, .add-sheet'

function visible(el: HTMLElement) {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth
}

// Closes the add-todo input (desktop/tablet: blur, dropdown folds up;
// phone: the add sheet slides away) — the same as pressing Escape in its
// title field (App.vue's onTodoInputEscape). After saving a todo the app
// keeps that field open and refocuses it on the next tick for the next
// todo, which in the tour just gets in the way — so this waits until that
// refocus has happened, then closes.
export function collapseAddTodo() {
  setTimeout(() => {
    for (const input of document.querySelectorAll<HTMLInputElement>('.add-input')) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    }
    const active = document.activeElement as HTMLElement | null
    if (active?.closest(ADD_FIELD)) active.blur()
  }, 0)
}

// Puts the caret back into whichever add-todo title field is on screen.
export function focusAddTitle() {
  const input = [...document.querySelectorAll<HTMLInputElement>('.add-input')].find(visible)
  input?.focus()
}

function pressEnter(el: HTMLElement) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
}

// Enter in the on-screen add-todo title field — on to the sub field, as if
// typed (App.vue's onTodoTitleEnter).
export function enterAddTitle() {
  const input = [...document.querySelectorAll<HTMLInputElement>('.add-input')].find(visible)
  if (input) pressEnter(input)
}

// Saves the draft in the add-todo input the way the user would: Enter in
// the sub field (App.vue's onSubDraftKeydown) — a half-typed sub gets
// added first, then Enter on the now-empty line saves the todo.
export function submitAddTodo() {
  const sub = [...document.querySelectorAll<HTMLInputElement>('.add-sub-input')].find(visible)
  if (!sub) return
  if (sub.value.trim()) pressEnter(sub)
  // v-model clears the field on the next render.
  setTimeout(() => pressEnter(sub), 0)
}

// The todo the tour had the user type, remembered when it's saved so that
// stepping back can take it out of the list and put it back into the
// input as an unsaved draft again.
let savedTodo: { id: string; title: string; tags: string[]; subs: string[] } | null = null

export function rememberNewestTodo() {
  const newest = [...useTodosStore().activeTodos].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  savedTodo = newest
    ? { id: newest.id, title: newest.title, tags: [...newest.tags], subs: newest.subs.map(s => s.title) }
    : null
}

// Returns false when there was no saved todo to restore.
export function restoreSavedTodo(focus: 'title' | 'sub'): boolean {
  if (!savedTodo) return false
  const { id, title, tags, subs } = savedTodo
  savedTodo = null
  useTodosStore().deleteTodo(id)
  requestTodoDraft({ title, tags, subs, caret: 'end', focus })
  return true
}

export function forgetSavedTodo() {
  savedTodo = null
}

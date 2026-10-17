import { ref } from 'vue'

export interface TodoDraftRequest {
  title: string
  tags: string[]
  // Where the caret lands in the prefilled title.
  caret: 'start' | 'end'
  // Staged subs to restore along with the title (the tour's back step).
  subs?: string[]
  // Which field ends up focused — the title (default) or the sub field.
  focus?: 'title' | 'sub'
}

// A request to prefill App.vue's add-todo input from somewhere else (e.g.
// TodoCard.vue's "sub → own todo" icon) — App.vue owns the draft state and
// watches this, so callers don't need a path through the views to reach it.
export const todoDraftRequest = ref<TodoDraftRequest | null>(null)

export function requestTodoDraft(request: TodoDraftRequest) {
  todoDraftRequest.value = request
}

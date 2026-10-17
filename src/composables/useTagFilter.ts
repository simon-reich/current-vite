import { ref } from 'vue'

// Overview's active tag filters (empty = all) — App.vue owns the filter UI
// and logic around it, this is just where the state lives, so the tour
// (see tutorial/) can read and set it too without a path through App.vue.
export const activeTagIds = ref<string[]>([])

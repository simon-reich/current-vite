import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { drawCelebrationKey, type CelebrationKey } from '../composables/useCelebrations'
import { isLoopDueToday } from '../composables/useLoopSchedule'
import { useThemeStore } from './theme'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export const PRIORITY_TAG_ID = '__priority__'
export const LOOP_TAG_ID = '__loop__'

export interface Tag {
  id: string
  label: string
}

export type LoopUnit = 'day' | 'week' | 'month' | 'year' | 'weekdays'

export interface LoopInterval {
  /** 'once' is a plain one-time due date, no recurrence — unit/count are
   *  unused. Absent/undefined means legacy data from before this field
   *  existed, which always had unit+count set: treat as 'loop'. */
  mode?: 'once' | 'loop'
  unit?: LoopUnit
  count?: number
  /** Only used when unit === 'weekdays' — the selected days, as
   *  JS Date.getDay() values (0 = Sunday .. 6 = Saturday). count is unused
   *  in this unit; due-ness is purely "is today one of these days". */
  weekdays?: number[]
  /** ISO date (YYYY-MM-DD) — the recurrence's start date in loop mode, or
   *  the due date itself in once mode. */
  startDate: string
  /** Loop mode only. When true, checking this todo off as "Done for
   *  today" shifts startDate to that moment instead of leaving it fixed —
   *  so a todo due every 3 days, but actually ticked off a day late,
   *  counts its next occurrence 3 days from the actual check-off rather
   *  than from the original schedule. Default false (fixed schedule,
   *  existing behavior). No effect in 'once' mode or on 'weekdays' unit,
   *  where due-ness doesn't depend on startDate at all. */
  rescheduleFromCompletion?: boolean
}

export interface Sub {
  id: string
  title: string
  /** ISO-Timestamp when checked; undefined = still open. */
  completedAt?: string
}

export interface Todo {
  id: string
  title: string
  tags: string[]
  createdAt: string
  inToday: boolean
  /** Optional sub-todos — live and die with this todo, no independent
   *  schedule/archive of their own (unlike Checks). See Sub above. */
  subs: Sub[]
  /** When this todo was last sent to Focus — drives Focus's own sort
   *  order (oldest addition first), separate from createdAt. */
  focusAddedAt?: string
  completedAt?: string
  workLog: string[]
  loopInterval?: LoopInterval
  /** Sorted ISO dates (YYYY-MM-DD) this todo is planned on a future/today
   *  Date List for — see CLAUDE.md's "Date Lists" section. Independent of
   *  `inToday`: a todo can sit on any number of these while still showing
   *  normally in Overview (and can additionally be in the default Focus
   *  list at the same time). Absent/empty = not planned on any list. */
  focusDates?: string[]
  /** Set when `rolloverExpiredFocusDates` auto-returns an unfinished
   *  Date-List todo to the pool at day-change — bumps it to the top of
   *  Overview's "date" sort (see AllTodos.vue's lastTouched) without
   *  faking a real workLog entry (which would wrongly show up on the
   *  calendar as a worked-on day). */
  poolBumpedAt?: string
  /** Which celebration (see TodoCard.vue's "Celebration-Animationen"
   *  section) plays when this todo is completed — assigned once in
   *  sendToToday below, fixed for as long as it stays in Focus, rather
   *  than re-rolled every time its check-menu happens to open. Absent for
   *  a todo that's never been sent to Focus since this field existed. */
  celebration?: CelebrationKey
  /** Set instead of actually removing the todo when it's deleted while it
   *  still has calendar-relevant history (a completedAt or a non-empty
   *  workLog) — see deleteTodo below. Filtered out of every active list
   *  (activeTodos/todayTodos) same as completedAt, but the calendar still
   *  reads completedAt/workLog directly off it, so deleting a todo can
   *  never retroactively erase days it already showed on past calendars.
   *  A todo that was deleted with no history at all (never completed, no
   *  workLog) has nothing worth keeping and is just removed outright. */
  deletedAt?: string
}

export const useTodosStore = defineStore('todos', () => {
  const todos = ref<Todo[]>([])
  const tags = ref<Tag[]>([])

  // One-time migration for the brief window this app had a separate
  // append-only `history` log (one row per Done/Done-for-today event,
  // never touched by deleteTodo) instead of the deletedAt approach below.
  // Any todo it logged that's since been hard-deleted and is gone from
  // `todos` now would otherwise vanish from the calendar for good — so
  // reconstruct a deletedAt stub for exactly those (todos that are still
  // alive already carry their own completedAt/workLog, nothing to do).
  // Safe to run every load: once a todoId exists in `todos` (stub or
  // otherwise), it's skipped.
  try {
    const raw = localStorage.getItem('todos')
    const oldHistory = raw ? JSON.parse(raw)?.history : null
    if (Array.isArray(oldHistory) && oldHistory.length) {
      const byTodo = new Map<string, { title: string; done?: string; workLog: string[] }>()
      for (const h of oldHistory as { todoId: string; title: string; date: string; type: 'done' | 'worklog' }[]) {
        const entry = byTodo.get(h.todoId) ?? { title: h.title, workLog: [] }
        if (h.type === 'done') entry.done = h.date
        else entry.workLog.push(`${h.date}T00:00:00.000Z`)
        byTodo.set(h.todoId, entry)
      }
      const existingIds = new Set(todos.value.map(t => t.id))
      for (const [todoId, entry] of byTodo) {
        if (existingIds.has(todoId)) continue
        todos.value.push({
          id: todoId,
          title: entry.title,
          tags: [],
          createdAt: entry.workLog[0] ?? (entry.done ? `${entry.done}T00:00:00.000Z` : new Date().toISOString()),
          inToday: false,
          subs: [],
          workLog: entry.workLog,
          completedAt: entry.done ? `${entry.done}T00:00:00.000Z` : undefined,
          deletedAt: new Date().toISOString(),
        })
      }
    }
  } catch {
    // Malformed/missing localStorage entry — nothing to migrate.
  }

  // ── Getters ──
  const activeTodos = computed(() =>
    todos.value.filter(t => !t.completedAt && !t.deletedAt)
  )

  // Whether a Date List exists for `dateStr` — purely derived from
  // `focusDates`, no separate list entity (see CLAUDE.md's Date Lists
  // section). Only ever meaningful for today when deciding what Focus
  // shows; kept general so runLoopSchedule can reuse it.
  function hasFocusDateList(dateStr: string): boolean {
    return todos.value.some(t => !t.completedAt && !t.deletedAt && t.focusDates?.includes(dateStr))
  }

  // A Date List for today, once it exists, replaces the default Focus
  // list entirely for that day (explicit product decision — see plan
  // discussion) rather than merging with whatever's in `inToday`. Due
  // loop/once todos still auto-join it (runLoopSchedule routes them here
  // instead of into `inToday` on such a day — see useLoopSchedule.ts).
  const todayTodos = computed(() => {
    const themeStore = useThemeStore()
    const today = todayStr()
    if (themeStore.dateListsEnabled && hasFocusDateList(today)) {
      return todos.value.filter(t =>
        !t.completedAt && !t.deletedAt &&
        (t.focusDates?.includes(today) ||
          (t.loopInterval && isLoopDueToday(t.loopInterval, new Date(), t.createdAt.slice(0, 10))))
      )
    }
    return todos.value.filter(t => t.inToday && !t.completedAt && !t.deletedAt)
  })

  // Unique future (> today) dates with at least one active todo planned on
  // them — feeds the Calendar's Date-List markers and Focus's Lists panel.
  const futureFocusDates = computed(() => {
    const today = todayStr()
    const dates = new Set<string>()
    todos.value.forEach(t => {
      if (t.completedAt || t.deletedAt) return
      t.focusDates?.forEach(d => { if (d > today) dates.add(d) })
    })
    return [...dates].sort()
  })

  function todosForFocusDate(dateStr: string): Todo[] {
    return todos.value.filter(t => !t.completedAt && !t.deletedAt && t.focusDates?.includes(dateStr))
  }

  // Completed / worked-on todos for a given calendar day (YYYY-MM-DD), used
  // by Calendar.vue's day-detail list. Reads completedAt/workLog straight
  // off the todos — including deletedAt ones, which is exactly why deleted
  // todos with real history are kept around as stubs instead of removed
  // (see deleteTodo below) rather than purged outright.
  function completedOn(dateStr: string) {
    return todos.value.filter(t => t.completedAt?.slice(0, 10) === dateStr)
  }

  function workedOn(dateStr: string) {
    const doneIds = new Set(completedOn(dateStr).map(t => t.id))
    return todos.value.filter(t =>
      !doneIds.has(t.id) && t.workLog.some(ts => ts.slice(0, 10) === dateStr)
    )
  }

  // Subs completed on a given calendar day, grouped by their parent todo —
  // Calendar.vue's day-detail merges this into its entry list so progress on
  // a todo's subs shows up even on a day the todo itself was never Done or
  // Done-for-today. Same "reads all todos, deletedAt stubs included" shape
  // as completedOn/workedOn above, for the same reason.
  function subsCompletedOn(dateStr: string): { todo: Todo; subs: Sub[] }[] {
    return todos.value
      .map(todo => ({ todo, subs: todo.subs.filter(s => s.completedAt?.slice(0, 10) === dateStr) }))
      .filter(entry => entry.subs.length > 0)
  }

  // ── Todo Actions ──
  function addTodo(title: string, extra: Partial<Pick<Todo, 'tags' | 'loopInterval'>> & { subs?: string[] } = {}): Todo {
    const todo: Todo = {
      id: uuid(),
      title: title.trim(),
      tags: extra.tags ?? [],
      createdAt: new Date().toISOString(),
      inToday: false,
      subs: (extra.subs ?? []).map(subTitle => ({ id: uuid(), title: subTitle.trim() })).filter(s => s.title),
      workLog: [],
      loopInterval: extra.loopInterval,
    }
    todos.value.unshift(todo)
    return todo
  }

  function addSub(todoId: string, title: string): Sub | undefined {
    const todo = todos.value.find(t => t.id === todoId)
    const trimmed = title.trim()
    if (!todo || !trimmed) return
    const sub: Sub = { id: uuid(), title: trimmed }
    todo.subs.push(sub)
    return sub
  }

  function toggleSub(todoId: string, subId: string) {
    const sub = todos.value.find(t => t.id === todoId)?.subs.find(s => s.id === subId)
    if (!sub) return
    sub.completedAt = sub.completedAt ? undefined : new Date().toISOString()
  }

  function deleteSub(todoId: string, subId: string) {
    const todo = todos.value.find(t => t.id === todoId)
    if (!todo) return
    todo.subs = todo.subs.filter(s => s.id !== subId)
  }

  function updateSub(todoId: string, subId: string, title: string) {
    const sub = todos.value.find(t => t.id === todoId)?.subs.find(s => s.id === subId)
    const trimmed = title.trim()
    if (!sub || !trimmed) return
    sub.title = trimmed
  }

  function updateTodo(id: string, patch: Partial<Pick<Todo, 'title' | 'tags' | 'loopInterval' | 'celebration'>>) {
    const todo = todos.value.find(t => t.id === id)
    if (!todo) return
    if (patch.title !== undefined) todo.title = patch.title.trim()
    if (patch.tags !== undefined) todo.tags = patch.tags
    if ('loopInterval' in patch) todo.loopInterval = patch.loopInterval
    if (patch.celebration !== undefined) todo.celebration = patch.celebration
  }

  // Hard-removes a todo that never had any calendar-relevant history (never
  // completed, no workLog) — nothing worth keeping. One that does have
  // history is soft-deleted instead (deletedAt set, stays in `todos`) so the
  // calendar keeps showing what it already showed for past days; see the
  // deletedAt field's own comment on Todo above.
  function deleteTodo(id: string) {
    const todo = todos.value.find(t => t.id === id)
    if (!todo) return
    if (todo.completedAt || todo.workLog.length > 0 || todo.subs.some(s => s.completedAt)) {
      todo.deletedAt = new Date().toISOString()
    } else {
      todos.value = todos.value.filter(t => t.id !== id)
    }
  }

  function sendToToday(id: string) {
    const todo = todos.value.find(t => t.id === id)
    if (todo) {
      todo.inToday = true
      todo.focusAddedAt = new Date().toISOString()
      // Fresh roll each time it re-enters Focus, not just once ever — see
      // Todo.celebration's own comment.
      todo.celebration = drawCelebrationKey()
    }
  }

  // Leaving today's Focus, however the todo got there — whether via the
  // default `inToday` flag or via today's own Date List. Callers (the
  // CircleMinus button, swipe-left, the D shortcut) don't need to know
  // which mechanism is currently showing the card.
  function removeFromToday(id: string) {
    const todo = todos.value.find(t => t.id === id)
    if (todo) {
      todo.inToday = false
      unassignFocusDate(id, todayStr())
    }
  }

  function completeTodo(id: string) {
    const todo = todos.value.find(t => t.id === id)
    if (todo) {
      todo.completedAt = new Date().toISOString()
      todo.inToday = false
      // A real Done means this todo is finished, period — pull it off
      // every future Date List it was still planned on, not just today's.
      todo.focusDates = undefined
    }
  }

  function doneForToday(id: string) {
    const todo = todos.value.find(t => t.id === id)
    if (todo) {
      const now = new Date()
      todo.workLog.push(now.toISOString())
      todo.inToday = false
      // Only today's slot is handled — a todo can be planned on several
      // future Date Lists at once (see focusDates), and "done for today"
      // says nothing about those other days.
      unassignFocusDate(id, todayStr())
      // Opt-in per-todo (see LoopInterval.rescheduleFromCompletion) — the
      // next occurrence counts from this check-off instead of the
      // original fixed schedule.
      if (todo.loopInterval?.rescheduleFromCompletion && (todo.loopInterval.mode ?? 'loop') === 'loop') {
        todo.loopInterval.startDate = now.toISOString().slice(0, 10)
      }
    }
  }

  // ── Date Lists ──
  function assignFocusDate(id: string, dateStr: string) {
    const todo = todos.value.find(t => t.id === id)
    if (!todo) return
    const dates = new Set(todo.focusDates ?? [])
    dates.add(dateStr)
    todo.focusDates = [...dates].sort()
  }

  function unassignFocusDate(id: string, dateStr: string) {
    const todo = todos.value.find(t => t.id === id)
    if (!todo?.focusDates) return
    todo.focusDates = todo.focusDates.filter(d => d !== dateStr)
    if (!todo.focusDates.length) todo.focusDates = undefined
  }

  function deleteFocusDateList(dateStr: string) {
    todos.value.forEach(t => {
      if (t.focusDates?.includes(dateStr)) unassignFocusDate(t.id, dateStr)
    })
  }

  // Unfinished Date-List todos don't roll forward to the next list/default
  // Focus — they just fall back into the pool (see plan discussion), bumped
  // to the top of Overview's "date" sort via poolBumpedAt so they're easy
  // to spot again. Called from the same three App.vue hooks that already
  // drive runLoopSchedule/checksStore.refreshToday (mount, midnight, tab
  // refocus) — same "day may have changed under us" problem.
  function rolloverExpiredFocusDates() {
    const today = todayStr()
    const now = new Date().toISOString()
    todos.value.forEach(t => {
      if (!t.focusDates?.length) return
      const remaining = t.focusDates.filter(d => d >= today)
      if (remaining.length === t.focusDates.length) return
      t.focusDates = remaining.length ? remaining : undefined
      t.poolBumpedAt = now
    })
  }

  // Todos persisted before Subs existed have no `subs` field at all — the
  // localStorage-restore that pinia-plugin-persistedstate runs happens
  // after this store's own setup() body (see the history migration above,
  // which has the same "todos.value is still empty here" problem and
  // works around it by reading localStorage directly), so a migration
  // pass here can't fix already-hydrated data. Called from App.vue's
  // onMounted instead — same spot/pattern as ensureSystemTags below —
  // which always runs after hydration. Without this, any Subs UI reading
  // `todo.subs` on such a todo (v-for, .length, ...) throws immediately.
  function ensureSubsField() {
    todos.value.forEach(todo => {
      if (!todo.subs) todo.subs = []
    })
  }

  // ── System tags ──
  const userTags = computed(() => tags.value.filter(t => t.id !== PRIORITY_TAG_ID && t.id !== LOOP_TAG_ID))

  function ensureSystemTags() {
    const existing = tags.value.find(t => t.id === PRIORITY_TAG_ID)
    if (!existing) {
      tags.value.unshift({ id: PRIORITY_TAG_ID, label: 'prio' })
    } else if (existing.label !== 'prio') {
      // Keeps already-persisted installs (localStorage still holding the
      // old 'priority' label) in sync with the current label instead of
      // only applying it to brand-new tag lists.
      existing.label = 'prio'
    }

    const existingLoop = tags.value.find(t => t.id === LOOP_TAG_ID)
    if (!existingLoop) {
      const prioIdx = tags.value.findIndex(t => t.id === PRIORITY_TAG_ID)
      tags.value.splice(prioIdx + 1, 0, { id: LOOP_TAG_ID, label: 'date' })
    } else if (existingLoop.label !== 'date') {
      // Same label-migration idea as 'prio' above — the Loop feature grew
      // into the broader Date feature (once-off due dates, not just
      // recurrence), same tag id, just a new label for already-persisted
      // installs.
      existingLoop.label = 'date'
    }
  }

  // ── Tag Actions ──
  function addTag(label: string): Tag {
    const tag: Tag = { id: uuid(), label: label.trim() }
    tags.value.push(tag)
    return tag
  }

  function deleteTag(id: string) {
    if (id === PRIORITY_TAG_ID || id === LOOP_TAG_ID) return
    tags.value = tags.value.filter(t => t.id !== id)
    todos.value.forEach(todo => {
      todo.tags = todo.tags.filter(tid => tid !== id)
    })
  }

  // ── Import ──
  // `history` is an optional leftover from export files made during this
  // app's brief append-only-log design — same idea as the localStorage
  // migration above: reconstruct a deletedAt stub for any todoId it
  // mentions that isn't in the imported todos themselves.
  function importData(data: { todos: Todo[]; tags: Tag[]; history?: { todoId: string; title: string; date: string; type: 'done' | 'worklog' }[] }) {
    // Absent in files exported before Subs existed — default to none.
    todos.value = data.todos.map(t => ({ ...t, subs: t.subs ?? [] }))
    tags.value = data.tags
    if (data.history?.length) {
      const byTodo = new Map<string, { title: string; done?: string; workLog: string[] }>()
      for (const h of data.history) {
        const entry = byTodo.get(h.todoId) ?? { title: h.title, workLog: [] }
        if (h.type === 'done') entry.done = h.date
        else entry.workLog.push(`${h.date}T00:00:00.000Z`)
        byTodo.set(h.todoId, entry)
      }
      const existingIds = new Set(todos.value.map(t => t.id))
      for (const [todoId, entry] of byTodo) {
        if (existingIds.has(todoId)) continue
        todos.value.push({
          id: todoId,
          title: entry.title,
          tags: [],
          createdAt: entry.workLog[0] ?? (entry.done ? `${entry.done}T00:00:00.000Z` : new Date().toISOString()),
          inToday: false,
          subs: [],
          workLog: entry.workLog,
          completedAt: entry.done ? `${entry.done}T00:00:00.000Z` : undefined,
          deletedAt: new Date().toISOString(),
        })
      }
    }
  }

  return {
    // state
    todos, tags,
    // getters
    activeTodos, todayTodos, userTags, futureFocusDates,
    completedOn, workedOn, subsCompletedOn, todosForFocusDate, hasFocusDateList,
    // actions
    addTodo, updateTodo, deleteTodo, sendToToday, removeFromToday, completeTodo, doneForToday,
    addSub, toggleSub, deleteSub, updateSub,
    addTag, deleteTag, ensureSystemTags, ensureSubsField,
    assignFocusDate, unassignFocusDate, deleteFocusDateList, rolloverExpiredFocusDates,
    importData,
  }
}, {
  persist: true,
})

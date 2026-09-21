import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { drawCelebrationKey, type CelebrationKey } from '../composables/useCelebrations'
import { isLoopDueToday } from '../composables/useLoopSchedule'
import { todayStr } from '../composables/useToday'
import { uuid } from '../composables/useId'
import { useThemeStore } from './theme'

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
  /** How many still-unchecked subs sat above this one at the moment it
   *  actually sank to the bottom (see sinkSub/SUB_SINK_DELAY_MS below) —
   *  only set while sunk, cleared again once restored. Persisted on the sub
   *  itself (not kept in component state) so unchecking it later still puts
   *  it back where it came from even after a view switch or reload in the
   *  meantime — a TodoCard instance doesn't live nearly that long. */
  sunkRank?: number
}

export interface Todo {
  id: string
  title: string
  tags: string[]
  createdAt: string
  /** Whether this todo is on Current — a day-agnostic, persistent list the
   *  user curates by hand (see CLAUDE.md's Pool concept). Named `inCurrent`,
   *  not `inToday`: despite "Done for today" being how you clear an item off
   *  it, membership itself has no date attached and never resets. */
  inCurrent: boolean
  /** Optional sub-todos — live and die with this todo, no independent
   *  schedule/archive of their own (unlike Checks). See Sub above. */
  subs: Sub[]
  /** When this todo was last sent to Current — drives Current's own sort
   *  order (oldest addition first), separate from createdAt. */
  focusAddedAt?: string
  completedAt?: string
  workLog: string[]
  loopInterval?: LoopInterval
  /** Sorted ISO dates (YYYY-MM-DD) this todo is planned on a future/today
   *  Date List for — see CLAUDE.md's "Date Lists" section. Independent of
   *  `inCurrent`: a todo can sit on any number of these while still showing
   *  normally in Overview (and can additionally be in Current at the same
   *  time). Absent/empty = not planned on any list. */
  focusDates?: string[]
  /** Sorted ISO dates (YYYY-MM-DD) a due Date Todo (`loopInterval` set) was
   *  explicitly removed from that future Date List's live preview —
   *  `todosForFocusDate` normally recomputes a due Date Todo onto every
   *  matching day's preview from its schedule alone (nothing stored), so
   *  without this a removal would just reappear on the next render/reload.
   *  Only meaningful for `loopInterval` todos; only future dates ever get
   *  added (see `unassignFocusDate`) and stale entries are trimmed the same
   *  way as `focusDates` in `rolloverExpiredFocusDates`. Re-assigning the
   *  todo to that date (`assignFocusDate`) clears the exclusion again. */
  excludedFocusDates?: string[]
  /** Set when `rolloverExpiredFocusDates` auto-returns an unfinished
   *  Date-List todo to the pool at day-change — bumps it to the top of
   *  Overview's "date" sort (see AllTodos.vue's lastTouched) without
   *  faking a real workLog entry (which would wrongly show up on the
   *  calendar as a worked-on day). */
  poolBumpedAt?: string
  /** Which celebration (see TodoCard.vue's "Celebration-Animationen"
   *  section) plays when this todo is completed — assigned once in
   *  sendToCurrent below, fixed for as long as it stays in Current, rather
   *  than re-rolled every time its check-menu happens to open. Absent for
   *  a todo that's never been sent to Current since this field existed. */
  celebration?: CelebrationKey
  /** Set instead of actually removing the todo when it's deleted while it
   *  still has calendar-relevant history (a completedAt or a non-empty
   *  workLog) — see deleteTodo below. Filtered out of every active list
   *  (activeTodos/currentTodos) same as completedAt, but the calendar still
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
          inCurrent: false,
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
  // section). Used for today specifically to decide whether a newly-due
  // Date Todo should also join that list (see runLoopSchedule/App.vue's
  // addTodo), and generally for the sidebar's Today/Tomorrow nav.
  function hasFocusDateList(dateStr: string): boolean {
    if (!useThemeStore().dateListsEnabled) return false
    return todos.value.some(t => !t.completedAt && !t.deletedAt && t.focusDates?.includes(dateStr))
  }

  // Current is purely `inCurrent` — day-agnostic, never auto-swapped for a
  // Date List (explicit product decision reversing an earlier one: Current
  // and "today's Date List" are two genuinely independent lists, not one
  // replacing the other; see CLAUDE.md's Date Lists section). A due
  // loop/once todo lands in inCurrent via runLoopSchedule/sendToCurrent
  // same as ever, and — separately, if a Date List for today exists —
  // also gets assigned today's focusDate; the two memberships don't affect
  // each other.
  const currentTodos = computed(() =>
    todos.value.filter(t => t.inCurrent && !t.completedAt && !t.deletedAt)
  )

  // Unique future (> today) dates with at least one active todo planned on
  // them — feeds the Calendar's Date-List markers and Current's Lists panel.
  const futureFocusDates = computed(() => {
    const today = todayStr()
    const dates = new Set<string>()
    todos.value.forEach(t => {
      if (t.completedAt || t.deletedAt) return
      t.focusDates?.forEach(d => { if (d > today) dates.add(d) })
    })
    return [...dates].sort()
  })

  // A Date List preview is a full preview of that day, not just what's
  // explicitly planned there — a Date Todo (loop/once) due on `dateStr`
  // belongs on it too, computed live off its current schedule rather than
  // stored anywhere, so a later reschedule/interval edit is reflected
  // automatically without this list needing to be touched. Mirrors how
  // checksStore.checksDueOn does the same for Checks — see CLAUDE.md's
  // Date Lists section.
  function todosForFocusDate(dateStr: string): Todo[] {
    return todos.value.filter(t =>
      !t.completedAt && !t.deletedAt &&
      (t.focusDates?.includes(dateStr) ||
        (t.loopInterval && !t.excludedFocusDates?.includes(dateStr) &&
          isLoopDueToday(t.loopInterval, new Date(`${dateStr}T12:00:00`), t.createdAt.slice(0, 10))))
    )
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
      inCurrent: false,
      subs: (extra.subs ?? []).map(subTitle => ({ id: uuid(), title: subTitle.trim() })).filter(s => s.title),
      workLog: [],
      loopInterval: extra.loopInterval,
    }
    todos.value.unshift(todo)
    return todo
  }

  // Checking a sub sinks it to the bottom of its own list after a delay
  // instead of instantly — long enough that an accidental tap can still be
  // undone with a quick second click before the item jumps away underneath
  // it. Lives here (not in TodoCard.vue) so the delay, and the sink itself,
  // survive the component that triggered it being unmounted (any view
  // switch) — see Sub.sunkRank's own comment. Keyed by sub id so several
  // subs mid-delay at once don't clobber each other.
  const SUB_SINK_DELAY_MS = 900
  const pendingSubSinkTimers = new Map<string, ReturnType<typeof setTimeout>>()

  function cancelSubSink(subId: string) {
    const timer = pendingSubSinkTimers.get(subId)
    if (timer) {
      clearTimeout(timer)
      pendingSubSinkTimers.delete(subId)
    }
  }

  function scheduleSubSink(todoId: string, subId: string) {
    cancelSubSink(subId)
    pendingSubSinkTimers.set(subId, setTimeout(() => {
      pendingSubSinkTimers.delete(subId)
      sinkSub(todoId, subId)
    }, SUB_SINK_DELAY_MS))
  }

  // The actual move — separated from scheduleSubSink so a reload mid-delay
  // (which loses the pending timer, same as any other in-memory timer)
  // doesn't leave a sub forever un-sunk: nothing currently re-arms this on
  // load, but if that's ever needed, the move itself is already a plain,
  // reusable function to call again from wherever.
  function sinkSub(todoId: string, subId: string) {
    const todo = todos.value.find(t => t.id === todoId)
    if (!todo) return
    const fromIndex = todo.subs.findIndex(s => s.id === subId)
    if (fromIndex === -1) return
    const sub = todo.subs[fromIndex]
    if (!sub.completedAt) return
    if (sub.sunkRank === undefined) {
      sub.sunkRank = todo.subs.slice(0, fromIndex).filter(s => !s.completedAt).length
    }
    reorderSub(todoId, subId, todo.subs.length - 1)
  }

  // Mirror of sinkSub for unchecking: only restores if this sub had actually
  // sunk (sunkRank set) — a plain uncheck of a sub that never moved has
  // nothing to undo. Rank is clamped against how many unchecked subs
  // (excluding this one, already unchecked again by the time this runs)
  // currently exist, so it degrades gracefully to "end of the unchecked
  // group" if others were completed/removed while this one sat sunk at the
  // bottom.
  function restoreSunkSub(todoId: string, subId: string) {
    const todo = todos.value.find(t => t.id === todoId)
    const sub = todo?.subs.find(s => s.id === subId)
    if (!todo || !sub || sub.sunkRank === undefined) return
    const rank = sub.sunkRank
    sub.sunkRank = undefined
    const uncheckedCount = todo.subs.filter(s => s.id !== subId && !s.completedAt).length
    reorderSub(todoId, subId, Math.min(rank, uncheckedCount))
  }

  // Lands after the last unchecked sub, not necessarily at the very end of
  // the array — a plain push would drop a fresh sub below any subs that
  // already sank to the bottom on completion, landing it among the done
  // ones instead of joining the still-open group it actually belongs to.
  function addSub(todoId: string, title: string): Sub | undefined {
    const todo = todos.value.find(t => t.id === todoId)
    const trimmed = title.trim()
    if (!todo || !trimmed) return
    const sub: Sub = { id: uuid(), title: trimmed }
    const firstCompletedIndex = todo.subs.findIndex(s => s.completedAt)
    if (firstCompletedIndex === -1) {
      todo.subs.push(sub)
    } else {
      todo.subs.splice(firstCompletedIndex, 0, sub)
    }
    return sub
  }

  // Checking a sub off doesn't reorder it immediately — see scheduleSubSink
  // below for the delayed sink this schedules, and its own comment for why.
  // Unchecking it undoes whatever of that has happened so far: a still-
  // pending sink is simply cancelled (it never moved), an already-sunk one
  // is put back via restoreSunkSub. Both live in the store rather than in
  // TodoCard.vue so they survive the component itself being unmounted (any
  // view switch) — see Sub.sunkRank's own comment.
  function toggleSub(todoId: string, subId: string) {
    const sub = todos.value.find(t => t.id === todoId)?.subs.find(s => s.id === subId)
    if (!sub) return
    if (sub.completedAt) {
      sub.completedAt = undefined
      cancelSubSink(subId)
      restoreSunkSub(todoId, subId)
    } else {
      sub.completedAt = new Date().toISOString()
      scheduleSubSink(todoId, subId)
    }
  }

  function deleteSub(todoId: string, subId: string) {
    const todo = todos.value.find(t => t.id === todoId)
    if (!todo) return
    cancelSubSink(subId)
    todo.subs = todo.subs.filter(s => s.id !== subId)
  }

  function updateSub(todoId: string, subId: string, title: string) {
    const sub = todos.value.find(t => t.id === todoId)?.subs.find(s => s.id === subId)
    const trimmed = title.trim()
    if (!sub || !trimmed) return
    sub.title = trimmed
  }

  function reorderSub(todoId: string, subId: string, toIndex: number) {
    const todo = todos.value.find(t => t.id === todoId)
    if (!todo) return
    const fromIndex = todo.subs.findIndex(s => s.id === subId)
    if (fromIndex === -1) return
    const clamped = Math.max(0, Math.min(toIndex, todo.subs.length - 1))
    if (clamped === fromIndex) return
    const [moved] = todo.subs.splice(fromIndex, 1)
    todo.subs.splice(clamped, 0, moved)
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
    todo.subs.forEach(s => cancelSubSink(s.id))
    if (todo.completedAt || todo.workLog.length > 0 || todo.subs.some(s => s.completedAt)) {
      todo.deletedAt = new Date().toISOString()
    } else {
      todos.value = todos.value.filter(t => t.id !== id)
    }
  }

  function sendToCurrent(id: string) {
    const todo = todos.value.find(t => t.id === id)
    if (todo) {
      todo.inCurrent = true
      todo.focusAddedAt = new Date().toISOString()
      // Fresh roll each time it re-enters Current, not just once ever — see
      // Todo.celebration's own comment.
      todo.celebration = drawCelebrationKey()
    }
  }

  // Leaving Current — purely the `inCurrent` flag, independent of any Date
  // List this todo might also be on (see currentTodos above).
  function removeFromCurrent(id: string) {
    const todo = todos.value.find(t => t.id === id)
    if (todo) todo.inCurrent = false
  }

  function completeTodo(id: string) {
    const todo = todos.value.find(t => t.id === id)
    if (todo) {
      todo.completedAt = new Date().toISOString()
      todo.inCurrent = false
      // A real Done means this todo is finished, period — pull it off
      // every future Date List it was still planned on, not just today's.
      todo.focusDates = undefined
    }
  }

  // A "Date Todo" (once or loop, see LoopInterval) auto-joins both Current
  // and today's Date List as one due occurrence (see runLoopSchedule/
  // addTodo in App.vue) — its two memberships aren't independent choices
  // the way a plain todo's are, they're the same occurrence showing twice.
  function isDateTodo(todo: Todo): boolean {
    return !!todo.loopInterval && todo.tags.includes(LOOP_TAG_ID)
  }

  // Current's own "done for today" — inCurrent + workLog, and always also
  // clears today's focusDate if this todo happens to be on that list too.
  // Deliberately one-directional: Current is the broader, day-agnostic
  // list, so "done for today" there settles today's occurrence everywhere.
  // doneForTodayOnDate below does NOT mirror this for a plain todo — only
  // for a Date Todo, where both memberships are the same occurrence (see
  // isDateTodo) rather than two independent choices.
  function doneForToday(id: string) {
    const todo = todos.value.find(t => t.id === id)
    if (todo) {
      todo.workLog.push(new Date().toISOString())
      todo.inCurrent = false
      unassignFocusDate(id, todayStr())
      applyLoopReschedule(todo)
    }
  }

  // The Date List equivalent of doneForToday — unassigns just this one
  // date (a todo can be planned on several Date Lists at once). Unlike
  // doneForToday, this direction stays one-way for a plain todo (leaves
  // `inCurrent` untouched — the narrower Today-list view shouldn't reach
  // back and clear the broader Current list); only for a Date Todo checked
  // off on *today's* list does it also clear `inCurrent` (same occurrence,
  // see isDateTodo/doneForToday).
  function doneForTodayOnDate(id: string, dateStr: string) {
    const todo = todos.value.find(t => t.id === id)
    if (todo) {
      todo.workLog.push(new Date().toISOString())
      unassignFocusDate(id, dateStr)
      if (dateStr === todayStr() && isDateTodo(todo)) todo.inCurrent = false
      applyLoopReschedule(todo)
    }
  }

  // Opt-in per-todo (see LoopInterval.rescheduleFromCompletion) — the next
  // occurrence counts from this check-off instead of the original fixed
  // schedule. Shared by both doneForToday variants above.
  function applyLoopReschedule(todo: Todo) {
    if (todo.loopInterval?.rescheduleFromCompletion && (todo.loopInterval.mode ?? 'loop') === 'loop') {
      todo.loopInterval.startDate = todayStr()
    }
  }

  // ── Date Lists ──
  // A Date List only ever means "planned ahead" — a past day is already
  // over, so assigning one is refused outright here rather than relying on
  // every caller (widget, swipe zone, per-card quick-assign, ...) to check
  // first. Whatever UI led here should never have offered a past date in
  // the first place (see FocusDateWidget's DatePickerModal `disable-past`
  // and theme.ts's setSelectedFocusDate clamp) — this is the last line of
  // defense, not the primary guard.
  function assignFocusDate(id: string, dateStr: string) {
    if (dateStr < todayStr()) return
    const todo = todos.value.find(t => t.id === id)
    if (!todo) return
    const dates = new Set(todo.focusDates ?? [])
    dates.add(dateStr)
    todo.focusDates = [...dates].sort()
    if (todo.excludedFocusDates?.includes(dateStr)) {
      todo.excludedFocusDates = todo.excludedFocusDates.filter(d => d !== dateStr)
      if (!todo.excludedFocusDates.length) todo.excludedFocusDates = undefined
    }
  }

  // A Date Todo (loopInterval) due on dateStr isn't actually in focusDates
  // — it only shows there because todosForFocusDate recomputes it live
  // (see there), today's own Date List included (runLoopSchedule assigns
  // it a real focusDates entry for today, but the live recompute still
  // fires on top of that and would just re-add it the instant the stored
  // entry above is removed). Removing it from that day's preview therefore
  // can't just be an array removal like a normal assignment; it has to be
  // recorded as an explicit exclusion, or the next render/reload would
  // recompute it right back onto the list. dateStr >= today, not > —
  // excluding only future dates left today's own Date List unable to drop
  // a Date Todo at all.
  function unassignFocusDate(id: string, dateStr: string) {
    const todo = todos.value.find(t => t.id === id)
    if (!todo) return
    if (todo.focusDates?.includes(dateStr)) {
      todo.focusDates = todo.focusDates.filter(d => d !== dateStr)
      if (!todo.focusDates.length) todo.focusDates = undefined
    }
    if (todo.loopInterval && dateStr >= todayStr()) {
      const excluded = new Set(todo.excludedFocusDates ?? [])
      excluded.add(dateStr)
      todo.excludedFocusDates = [...excluded].sort()
    }
  }

  function deleteFocusDateList(dateStr: string) {
    todos.value.forEach(t => {
      if (t.focusDates?.includes(dateStr)) unassignFocusDate(t.id, dateStr)
    })
  }

  // Unfinished Date-List todos don't roll forward to the next list/default
  // Current — they just fall back into the pool (see plan discussion), bumped
  // to the top of Overview's "date" sort via poolBumpedAt so they're easy
  // to spot again. Called from the same three App.vue hooks that already
  // drive runLoopSchedule/checksStore.refreshToday (mount, midnight, tab
  // refocus) — same "day may have changed under us" problem.
  function rolloverExpiredFocusDates() {
    const today = todayStr()
    const now = new Date().toISOString()
    todos.value.forEach(t => {
      if (t.focusDates?.length) {
        const remaining = t.focusDates.filter(d => d >= today)
        if (remaining.length !== t.focusDates.length) {
          t.focusDates = remaining.length ? remaining : undefined
          t.poolBumpedAt = now
        }
      }
      // Same trim for excludedFocusDates — a past exclusion is meaningless
      // (that day's preview is history now) and would otherwise just grow
      // forever on a recurring Date Todo.
      if (t.excludedFocusDates?.length) {
        const remaining = t.excludedFocusDates.filter(d => d >= today)
        t.excludedFocusDates = remaining.length ? remaining : undefined
      }
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

  // Todos persisted before the `inToday` → `inCurrent` rename still carry
  // the old field name in localStorage — without this, every existing
  // Current list would read as empty the moment this version loads (see
  // ensureSubsField above for why this can't run any earlier than
  // App.vue's onMounted). Copies the legacy value over once, then leaves
  // the stale `inToday` key sitting unused in the persisted JSON — harmless,
  // never read again.
  function ensureInCurrentField() {
    todos.value.forEach(todo => {
      const legacy = todo as unknown as { inToday?: boolean; inCurrent?: boolean }
      if (typeof legacy.inCurrent !== 'boolean') legacy.inCurrent = legacy.inToday ?? false
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
          inCurrent: false,
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
    activeTodos, currentTodos, userTags, futureFocusDates,
    completedOn, workedOn, subsCompletedOn, todosForFocusDate, hasFocusDateList,
    // actions
    addTodo, updateTodo, deleteTodo, sendToCurrent, removeFromCurrent, completeTodo, doneForToday, doneForTodayOnDate,
    addSub, toggleSub, deleteSub, updateSub, reorderSub, SUB_SINK_DELAY_MS,
    addTag, deleteTag, ensureSystemTags, ensureSubsField, ensureInCurrentField,
    assignFocusDate, unassignFocusDate, deleteFocusDateList, rolloverExpiredFocusDates,
    importData,
  }
}, {
  persist: true,
})

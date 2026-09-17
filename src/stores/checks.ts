import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LoopUnit } from './todos'
import { isLoopDueToday } from '../composables/useLoopSchedule'

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// Short reminder phrases only, not full todo-length titles — Current's
// check-row now stacks them one per line (see Current.vue) instead of side
// by side, so this only needs to stay a single readable line rather than
// fit two columns.
export const CHECK_TITLE_MAX_LENGTH = 50

// Deliberately its own, narrower type rather than reusing Todo's
// LoopInterval directly: a Check is always recurring (no 'once' — see
// CLAUDE.md's Checks section), so there's no `mode` field to leave
// unset/ambiguous. Structurally compatible with LoopInterval regardless
// (mode/count/weekdays are all optional there too), so it still passes
// straight into isLoopDueToday/nextLoopOccurrence unchanged.
export interface CheckSchedule {
  unit: LoopUnit
  count?: number
  /** Only used when unit === 'weekdays' — see LoopInterval.weekdays. */
  weekdays?: number[]
  /** ISO date (YYYY-MM-DD) the recurrence counts from. */
  startDate: string
}

export interface Check {
  id: string
  title: string
  schedule: CheckSchedule
  createdAt: string
  /** ISO dates (YYYY-MM-DD), one per due day the checkbox was actually
   *  ticked. A Check never leaves Current when ticked (unlike a Todo's
   *  Done) — it just stays visible with the box marked — so this is a
   *  plain append/remove log, not a state transition. Whether a given due
   *  day was *missed* isn't stored explicitly: it's derived later (by
   *  whatever reads this, e.g. the calendar) as "due per `schedule` but
   *  absent here" instead of duplicating that bookkeeping. */
  completedDates: string[]
  /** Snapshot of `title` at the moment each date in completedDates was
   *  ticked — the calendar's own history shouldn't retroactively change
   *  just because the check was later renamed (same "don't touch the
   *  past" reasoning as deletedAt below, just for edits instead of
   *  deletes). Only ever appended/removed by toggleCompletion, in lockstep
   *  with completedDates. Optional/possibly missing an entry for a given
   *  date — data from before this field existed — in which case whatever
   *  reads it falls back to the check's current title (see titleOn). */
  titleLog?: { date: string; title: string }[]
  /** Soft-delete, same pattern/reasoning as Todo.deletedAt: set instead of
   *  actually removing a Check that has completedDates history, so a past
   *  calendar day never retroactively loses what it already showed. A
   *  Check with no history at all is just hard-removed instead. */
  deletedAt?: string
}

export const useChecksStore = defineStore('checks', () => {
  const checks = ref<Check[]>([])

  // ── Getters ──
  const activeChecks = computed(() => checks.value.filter(c => !c.deletedAt))

  // Checks due today — purely computed from each Check's own schedule, not
  // a stored flag (unlike Todo.inCurrent). A Check has no "sent to Current"
  // step to undo, so there's nothing here that needs Todo's
  // focusAddedAt/processedToday bookkeeping or a midnight store-mutation
  // pass (runLoopSchedule's equivalent) — it just needs to actually
  // recompute at the day boundary, which reading `new Date()` directly
  // inside the computed would *not* do (that call isn't reactive, so
  // nothing would ever re-run this after mount). `today` is the reactive
  // trigger instead — refreshToday() is called on app load, on every
  // local midnight, and on tab-refocus, same three call sites App.vue
  // already has wired up for runLoopSchedule (see useLoopSchedule.ts).
  const today = ref(todayStr())
  function refreshToday() {
    today.value = todayStr()
  }
  const todayChecks = computed(() =>
    activeChecks.value.filter(c => isLoopDueToday(c.schedule, new Date(`${today.value}T12:00:00`)))
  )

  function isCompletedOn(check: Check, dateStr: string): boolean {
    return check.completedDates.includes(dateStr)
  }

  // What the check was actually named when dateStr was ticked — see
  // titleLog's own comment. Falls back to the current title for dates
  // ticked before titleLog existed.
  function titleOn(check: Check, dateStr: string): string {
    return check.titleLog?.find(e => e.date === dateStr)?.title ?? check.title
  }

  // Calendar day-detail's completed side — which Checks were ticked on
  // dateStr. The "missed" side (due per schedule but not ticked) is left
  // to the caller to derive once the calendar view actually needs it,
  // rather than guessed at here ahead of that UI existing.
  function completedOn(dateStr: string) {
    return checks.value.filter(c => isCompletedOn(c, dateStr))
  }

  // ── Actions ──
  function addCheck(title: string, schedule: CheckSchedule): Check {
    const check: Check = {
      id: uuid(),
      title: title.trim().slice(0, CHECK_TITLE_MAX_LENGTH),
      schedule,
      createdAt: new Date().toISOString(),
      completedDates: [],
    }
    checks.value.unshift(check)
    return check
  }

  function updateCheck(id: string, patch: Partial<Pick<Check, 'title' | 'schedule'>>) {
    const check = checks.value.find(c => c.id === id)
    if (!check) return
    if (patch.title !== undefined) check.title = patch.title.trim().slice(0, CHECK_TITLE_MAX_LENGTH)
    if (patch.schedule !== undefined) check.schedule = patch.schedule
  }

  function deleteCheck(id: string) {
    const check = checks.value.find(c => c.id === id)
    if (!check) return
    if (check.completedDates.length > 0) {
      check.deletedAt = new Date().toISOString()
    } else {
      checks.value = checks.value.filter(c => c.id !== id)
    }
  }

  // Toggles a single day's completion — defaults to today, since that's
  // the only day Current ever shows a checkbox for, but takes an explicit
  // date so tests/future callers aren't forced through the system clock.
  function toggleCompletion(id: string, dateStr: string = todayStr()) {
    const check = checks.value.find(c => c.id === id)
    if (!check) return
    if (isCompletedOn(check, dateStr)) {
      check.completedDates = check.completedDates.filter(d => d !== dateStr)
      check.titleLog = (check.titleLog ?? []).filter(e => e.date !== dateStr)
    } else {
      check.completedDates = [...check.completedDates, dateStr]
      check.titleLog = [...(check.titleLog ?? []), { date: dateStr, title: check.title }]
    }
  }

  // Full-replace restore for useStorage.ts's import/import-everything —
  // mirrors useTodosStore.importData's semantics (replaces, doesn't merge).
  function importChecks(data: Check[]) {
    checks.value = data
  }

  return {
    // state
    checks,
    // getters
    activeChecks, todayChecks,
    completedOn, isCompletedOn, titleOn,
    // actions
    addCheck, updateCheck, deleteCheck, toggleCompletion, refreshToday, importChecks,
  }
}, {
  persist: true,
})

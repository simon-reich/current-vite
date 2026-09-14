import { defineStore } from 'pinia'
import { ref } from 'vue'
import { applyTheme } from '../composables/useTheme'

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

export interface ColorTheme {
  id: string
  name: string
  bg: string
  gray: string
}

export const useThemeStore = defineStore('theme', () => {
  const activeBg = ref('#E2E790')
  const activeGray = ref('#878080')
  const rounded = ref(true)
  const priorityShadow = ref<'mono' | 'dark'>('dark')
  const celebrationsEnabled = ref(true)
  const tagsEnabled = ref(true)
  const checksEnabled = ref(true)
  const subsEnabled = ref(true)
  const dateListsEnabled = ref(true)
  // The Focus Date widget's currently selected target date (YYYY-MM-DD) —
  // where new "plan ahead" assignments go. Persists across reloads (see
  // plan discussion) so multi-day planning doesn't reset on every visit.
  const selectedFocusDate = ref(todayStr())
  // Current-only: force every card's sub-list open without having to expand
  // each one individually — see Current.vue's own toggle switch.
  const expandCurrentSubs = ref(false)
  const savedThemes = ref<ColorTheme[]>([])
  const dailyThemeRotationEnabled = ref(false)
  // Last date (YYYY-MM-DD) a rotation actually happened — guards against
  // re-rolling every reload on the same day, same idea as loop todos'
  // focusAddedAt (see useLoopSchedule.ts's processedToday).
  const lastThemeRotationDate = ref<string | null>(null)

  function apply(bg: string, gray: string) {
    activeBg.value = bg
    activeGray.value = gray
    applyTheme(bg, gray, rounded.value, priorityShadow.value)
  }

  function toggleRounded() {
    rounded.value = !rounded.value
    applyTheme(activeBg.value, activeGray.value, rounded.value, priorityShadow.value)
  }

  function togglePriorityShadow() {
    priorityShadow.value = priorityShadow.value === 'dark' ? 'mono' : 'dark'
    applyTheme(activeBg.value, activeGray.value, rounded.value, priorityShadow.value)
  }

  function toggleCelebrations() {
    celebrationsEnabled.value = !celebrationsEnabled.value
  }

  function toggleTags() {
    tagsEnabled.value = !tagsEnabled.value
  }

  function toggleChecks() {
    checksEnabled.value = !checksEnabled.value
  }

  function toggleSubs() {
    subsEnabled.value = !subsEnabled.value
  }

  function toggleDateLists() {
    dateListsEnabled.value = !dateListsEnabled.value
  }

  function setSelectedFocusDate(dateStr: string) {
    selectedFocusDate.value = dateStr
  }

  function toggleExpandCurrentSubs() {
    expandCurrentSubs.value = !expandCurrentSubs.value
  }

  function saveTheme(name: string) {
    savedThemes.value.push({
      id: uuid(),
      name: name.trim() || 'Theme',
      bg: activeBg.value,
      gray: activeGray.value,
    })
  }

  function deleteTheme(id: string) {
    savedThemes.value = savedThemes.value.filter(t => t.id !== id)
  }

  function loadTheme(theme: ColorTheme) {
    apply(theme.bg, theme.gray)
  }

  function toggleDailyThemeRotation() {
    dailyThemeRotationEnabled.value = !dailyThemeRotationEnabled.value
  }

  // Picks a random saved theme once a day and applies it — called on app
  // load and again every midnight while the tab stays open (see App.vue,
  // same pattern as runLoopSchedule/scheduleLoopMidnightCheck). "Clever"
  // just means it won't reroll today's already-applied theme back to
  // itself when there's more than one to choose from, so two days in a
  // row never look the same by pure chance.
  function runDailyThemeRotation() {
    if (!dailyThemeRotationEnabled.value || savedThemes.value.length === 0) return
    // Local date, not toISOString's UTC date — scheduleLoopMidnightCheck fires
    // at local midnight, so the guard has to speak the same calendar day or
    // the UTC rollover a few hours later (re)triggers a second reshuffle on
    // the next reload.
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    if (lastThemeRotationDate.value === today) return
    const candidates = savedThemes.value.length > 1
      ? savedThemes.value.filter(t => !(t.bg === activeBg.value && t.gray === activeGray.value))
      : savedThemes.value
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    apply(pick.bg, pick.gray)
    lastThemeRotationDate.value = today
  }

  return {
    activeBg, activeGray, rounded, priorityShadow, celebrationsEnabled, tagsEnabled, checksEnabled, subsEnabled, expandCurrentSubs, savedThemes,
    dailyThemeRotationEnabled, lastThemeRotationDate, dateListsEnabled, selectedFocusDate,
    apply, toggleRounded, togglePriorityShadow, toggleCelebrations, toggleTags, toggleChecks, toggleSubs, toggleExpandCurrentSubs, saveTheme, deleteTheme, loadTheme,
    toggleDailyThemeRotation, runDailyThemeRotation, toggleDateLists, setSelectedFocusDate,
  }
}, { persist: true })

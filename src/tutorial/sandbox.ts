import { ref } from 'vue'
import type { StorageLike } from 'pinia-plugin-persistedstate'
import { useTodosStore } from '../stores/todos'
import { useChecksStore } from '../stores/checks'
import { useThemeStore } from '../stores/theme'
import { applyTheme } from '../composables/useTheme'
import { todayStr } from '../composables/useToday'

// The tutorial runs in an empty app without touching the real data. Every
// persisted store writes through tutorialAwareStorage (see main.ts): while
// the sandbox is active, reads/writes go to an in-memory map instead of
// localStorage, so the real todos/checks/theme stay exactly as they were.
// Leaving re-reads them from localStorage ($hydrate), a reload mid-tutorial
// simply lands back in the real app.
//
// Belt and braces: the real entries are also copied to BACKUP_KEY on
// entering, and put back on leaving — and by restoreTutorialBackup() on the
// next start if the tab died mid-tutorial — so even a stray write that
// slipped past the sandbox can't cost real data.

const SANDBOXED_KEYS = ['todos', 'checks', 'theme'] as const
const BACKUP_KEY = 'tutorial-backup'

export const sandboxActive = ref(false)
const sandboxData = new Map<string, string>()

export const tutorialAwareStorage: StorageLike = {
  getItem: (key) => (sandboxActive.value ? sandboxData.get(key) ?? null : localStorage.getItem(key)),
  setItem: (key, value) => {
    if (sandboxActive.value) sandboxData.set(key, value)
    else localStorage.setItem(key, value)
  },
}

// Called from main.ts before any store exists.
export function restoreTutorialBackup() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (!raw) return
    const backup = JSON.parse(raw) as Record<string, string | null>
    for (const key of SANDBOXED_KEYS) {
      const value = backup[key]
      if (value == null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    }
    localStorage.removeItem(BACKUP_KEY)
  } catch { /* unreadable backup — leave everything as is */ }
}

function hydrateAll() {
  useTodosStore().$hydrate()
  useChecksStore().$hydrate()
  useThemeStore().$hydrate()
}

// Features the tutorial walks through are switched on inside the sandbox,
// whatever the real settings say — the real ones come back on leaving.
const TUTORIAL_FEATURES = {
  tagsEnabled: true,
  subsEnabled: true,
  checksEnabled: true,
  dateListsEnabled: true,
}

export function enterSandbox(): boolean {
  if (sandboxActive.value) return true
  const backup: Record<string, string | null> = {}
  for (const key of SANDBOXED_KEYS) backup[key] = localStorage.getItem(key)
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup))
  } catch {
    return false
  }

  let realTheme: Record<string, unknown> = {}
  try { realTheme = JSON.parse(backup.theme ?? '{}') } catch { /* defaults */ }

  sandboxData.clear()
  sandboxData.set('todos', JSON.stringify({ todos: [], tags: [] }))
  sandboxData.set('checks', JSON.stringify({ checks: [] }))
  sandboxData.set('theme', JSON.stringify({ ...realTheme, ...TUTORIAL_FEATURES, selectedFocusDate: todayStr() }))
  sandboxActive.value = true
  hydrateAll()
  useTodosStore().ensureSystemTags()
  useChecksStore().refreshToday()
  return true
}

export function exitSandbox() {
  if (!sandboxActive.value) return
  sandboxActive.value = false
  sandboxData.clear()
  restoreTutorialBackup()
  hydrateAll()
  const theme = useThemeStore()
  applyTheme(theme.activeBg, theme.activeGray, theme.rounded, theme.priorityShadow)
}

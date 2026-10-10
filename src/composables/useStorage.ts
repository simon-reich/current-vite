import { useTodosStore } from '../stores/todos'
import { useThemeStore } from '../stores/theme'
import { useChecksStore } from '../stores/checks'
import { todayStr } from './useToday'

function readFileViaInput(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { reject(new Error('No file selected')); return }
      resolve(await file.text())
    }
    input.click()
  })
}

// Shared by every export* function below — writes the JSON payload to disk
// via the File System Access API where available, falling back to a plain
// `a[download]` click (e.g. Firefox, or Safari without the API).
async function writeJsonFile(payload: unknown, filename: string) {
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      // non-abort error → fall through to download fallback
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Shared by every import* function below — opens a file via the File
// System Access API where available, falling back to a plain
// `input[type=file]` click.
async function readJsonFile(): Promise<string | null> {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      })
      const file = await handle.getFile()
      return await file.text()
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null
      return await readFileViaInput()
    }
  }
  return await readFileViaInput()
}

// Every export payload below carries a `kind` tag identifying which of the
// three file types it is — lets each import* function reject a
// wrong-but-still-valid-JSON file up front (e.g. picking a themes export
// for "import everything") instead of silently importing a garbled subset
// of it.
type ExportKind = 'todos' | 'themes' | 'everything'

function checkKind(data: any, expected: ExportKind): string | null {
  if (data.kind === undefined) return null // pre-kind export, let it through
  if (data.kind !== expected) return `Expected a "${expected}" export, got "${data.kind}".`
  return null
}

export function useStorage() {
  async function exportData() {
    const store = useTodosStore()
    const checksStore = useChecksStore()
    const payload = {
      version: 1,
      kind: 'todos' as ExportKind,
      exportedAt: new Date().toISOString(),
      todos: store.todos,
      tags: store.tags,
      checks: checksStore.checks,
    }
    await writeJsonFile(payload, `todos-${todayStr()}.json`)
  }

  async function importData() {
    const store = useTodosStore()
    const checksStore = useChecksStore()
    try {
      const text = await readJsonFile()
      if (text === null) return

      const data = JSON.parse(text)
      const kindError = checkKind(data, 'todos')
      if (kindError) { alert(`Import failed: ${kindError}`); return }
      store.importData({
        todos: Array.isArray(data.todos) ? data.todos : [],
        tags: Array.isArray(data.tags) ? data.tags : [],
        history: Array.isArray(data.history) ? data.history : undefined,
      })
      // Absent in files exported before Checks existed — leave whatever's
      // already there instead of wiping it out.
      if (Array.isArray(data.checks)) checksStore.importChecks(data.checks)
    } catch {
      alert('Import failed: invalid or corrupted JSON file.')
    }
  }

  async function exportThemes() {
    const themeStore = useThemeStore()
    const payload = {
      version: 1,
      kind: 'themes' as ExportKind,
      exportedAt: new Date().toISOString(),
      themes: themeStore.savedThemes,
    }
    await writeJsonFile(payload, `themes-${todayStr()}.json`)
  }

  async function importThemes() {
    const themeStore = useThemeStore()
    try {
      const text = await readJsonFile()
      if (text === null) return

      const data = JSON.parse(text)
      const kindError = checkKind(data, 'themes')
      if (kindError) { alert(`Import failed: ${kindError}`); return }
      const incoming = Array.isArray(data.themes) ? data.themes : []
      const existingIds = new Set(themeStore.savedThemes.map(t => t.id))
      incoming.forEach((t: any) => {
        if (t.id && t.name && t.bg && t.gray && !existingIds.has(t.id)) {
          themeStore.savedThemes.push(t)
        }
      })
    } catch {
      alert('Import failed: invalid or corrupted JSON file.')
    }
  }

  // "everything all at once" — a single full-backup file (todos, tags,
  // saved themes, and the currently active bg/gray) for moving to a new
  // device or restoring after a wipe, as opposed to exportData/exportThemes
  // above which stay deliberately narrow (e.g. grabbing just a theme
  // someone shared, without touching the todo list at all).
  async function exportEverything() {
    const store = useTodosStore()
    const themeStore = useThemeStore()
    const checksStore = useChecksStore()
    const payload = {
      version: 1,
      kind: 'everything' as ExportKind,
      exportedAt: new Date().toISOString(),
      todos: store.todos,
      tags: store.tags,
      checks: checksStore.checks,
      themes: themeStore.savedThemes,
      activeBg: themeStore.activeBg,
      activeGray: themeStore.activeGray,
    }
    await writeJsonFile(payload, `everything-${todayStr()}.json`)
  }

  // Full restore, not a merge — mirrors importData's "replaces all current
  // data" semantics (see Settings.vue's confirm dialog) rather than
  // importThemes' additive dedupe-by-id, since this is meant to reproduce
  // exactly what exportEverything captured, not layer onto whatever's
  // already here.
  async function importEverything() {
    const store = useTodosStore()
    const themeStore = useThemeStore()
    const checksStore = useChecksStore()
    try {
      const text = await readJsonFile()
      if (text === null) return

      const data = JSON.parse(text)
      const kindError = checkKind(data, 'everything')
      if (kindError) { alert(`Import failed: ${kindError}`); return }
      store.importData({
        todos: Array.isArray(data.todos) ? data.todos : [],
        tags: Array.isArray(data.tags) ? data.tags : [],
      })
      // Absent in backups made before Checks existed — leave whatever's
      // already there instead of wiping it out.
      if (Array.isArray(data.checks)) checksStore.importChecks(data.checks)
      if (Array.isArray(data.themes)) themeStore.savedThemes = data.themes
      if (typeof data.activeBg === 'string' && typeof data.activeGray === 'string') {
        themeStore.apply(data.activeBg, data.activeGray)
      }
    } catch {
      alert('Import failed: invalid or corrupted JSON file.')
    }
  }

  return { exportData, importData, exportThemes, importThemes, exportEverything, importEverything }
}

export const MONO_FONT = 'Anonymous Pro'

// Font lab (Settings picker + stores/fontlab.ts) is hidden for now — fonts
// settled on Plus Jakarta Sans. Flip to bring the picker back; while it's
// off, the default below always applies, regardless of any persisted pick.
export const FONT_LAB_ENABLED = false

// Candidates for --font-playful, switchable live via the font lab.
export const PLAYFUL_FONTS = [
  'Caveat',
  'Edu QLD Hand',
  'Bitter',
  'Lexend',
  'Plus Jakarta Sans',
  'Raleway',
] as const

export type PlayfulFont = typeof PLAYFUL_FONTS[number]

export const DEFAULT_PLAYFUL_FONT: PlayfulFont = 'Plus Jakarta Sans'

export function applyAppFonts(playful: string, mono: string) {
  const root = document.documentElement
  root.style.setProperty('--font-playful', `'${playful}', sans-serif`)
  root.style.setProperty('--font-mono', `'${mono}', monospace`)
}

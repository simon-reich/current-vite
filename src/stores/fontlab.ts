import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { applyAppFonts, DEFAULT_PLAYFUL_FONT, FONT_LAB_ENABLED, MONO_FONT, PLAYFUL_FONTS, type PlayfulFont } from '../composables/useAppFonts'

// Font lab: lets Settings swap --font-playful live to compare candidates.
// Kept as its own store (not part of theme.ts) so the whole experiment can
// be dropped again in one go once a font is settled on.
export const useFontLabStore = defineStore('fontlab', () => {
  const playfulFont = ref<PlayfulFont>(DEFAULT_PLAYFUL_FONT)

  watch(playfulFont, (font) => {
    // A persisted font that's since been removed from the pool falls back to the default.
    if (!PLAYFUL_FONTS.includes(font)) { playfulFont.value = DEFAULT_PLAYFUL_FONT; return }
    applyAppFonts(FONT_LAB_ENABLED ? font : DEFAULT_PLAYFUL_FONT, MONO_FONT)
  }, { immediate: true })

  return { playfulFont }
}, { persist: true })

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import VCalendar from 'v-calendar'
import 'v-calendar/style.css'
import router from './router'
import './styles/fonts.css'
import './styles/base.css'
import './styles/calendar.css'
import './styles/layout.css'
import './styles/tablet.css'
import './styles/mobile.css'
import App from './App.vue'
import { applyTheme } from './composables/useTheme'
import { useFontLabStore } from './stores/fontlab'
import { seedDevData } from './dev/seed'
import { vTooltip } from './composables/useTooltip'
import { tutorialAwareStorage, restoreTutorialBackup } from './tutorial/sandbox'

// A tutorial cut short by a closed tab/reload puts the real data back first
// (see tutorial/sandbox.ts) — before the theme read below and before any
// store hydrates.
restoreTutorialBackup()

// Apply persisted theme before mount to avoid flash of default colors
try {
  const saved = localStorage.getItem('theme')
  if (saved) {
    const { activeBg, activeGray } = JSON.parse(saved)
    if (activeBg && activeGray) applyTheme(activeBg, activeGray)
  }
} catch { /* ignore */ }

if (import.meta.env.DEV) seedDevData()

const pinia = createPinia()
// Every persisted store writes through the tutorial-aware storage, so the
// tutorial can run in an empty sandbox without touching the real data.
pinia.use(createPersistedState({ storage: tutorialAwareStorage }))

const app = createApp(App)
app.use(pinia)
// Instantiated up front (not only once Settings opens) so the persisted
// font-lab choice is applied before mount.
useFontLabStore(pinia)
app.use(router)
app.use(VCalendar, {})
app.directive('tooltip', vTooltip)
app.mount('#vue-root')

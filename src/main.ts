import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
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
pinia.use(piniaPluginPersistedstate)

const app = createApp(App)
app.use(pinia)
// Instantiated up front (not only once Settings opens) so the persisted
// font-lab choice is applied before mount.
useFontLabStore(pinia)
app.use(router)
app.use(VCalendar, {})
app.mount('#vue-root')

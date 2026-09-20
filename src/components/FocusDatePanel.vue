<script setup lang="ts">
import { computed, watch } from 'vue'
import { X } from '@lucide/vue'
import { useThemeStore } from '../stores/theme'
import { todayStr } from '../composables/useToday'
import { activeModal } from '../composables/useModalGuard'
import FocusDateNav from './FocusDateNav.vue'

// Tablet-only alternative to DatePickerModal's plain centered calendar,
// opened by FocusDateWidget instead of that modal when its `panel` prop is
// set (see FocusDateWidget.vue). Desktop already has an always-visible
// Date-List nav in its own sidebar (App.vue's aside) and doesn't need
// this; phone needs its own, differently-shaped answer later — not enough
// width there for a 1/3-screen side panel — so this is specifically the
// tablet one. Combines the plain calendar (any date) with the same
// today/tomorrow/preset-week/upcoming-lists nav the desktop sidebar
// already shows, via FocusDateNav.vue (single source of truth for both).
//
// Stays mounted for as long as the pill that owns it exists (v-if="panel"
// on FocusDateWidget's own side) rather than being created fresh per open
// — `open` is a plain prop toggling v-show inside a Transition, which is
// what lets it actually slide in/out instead of just popping.
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const themeStore = useThemeStore()

function close() {
  emit('close')
}

function pickDate(day: { id: string }) {
  if (day.id < todayStr()) return
  themeStore.setSelectedFocusDate(day.id)
}

const dateAttributes = computed(() => [{
  key: 'selected',
  highlight: {
    style: { backgroundColor: 'var(--ink-dark)', borderRadius: '4px' },
    contentStyle: { color: 'var(--bg)' },
  },
  dates: new Date(themeStore.selectedFocusDate + 'T12:00:00'),
}])

const minDate = new Date(todayStr() + 'T00:00:00')

// Same app-wide modal guard every other overlay uses (Escape closes this),
// registered/cleared as `open` itself changes rather than on mount/unmount
// — this component stays mounted the whole time the pill exists, only
// `open` toggles.
watch(() => props.open, (isOpen) => {
  if (isOpen) activeModal.value = { onCancel: close, onConfirm: close }
  else if (activeModal.value?.onCancel === close) activeModal.value = null
}, { immediate: true })
</script>

<template>
  <Teleport to="body">
    <Transition name="fdp-backdrop">
      <div v-show="open" class="fdp-backdrop" @click="close" />
    </Transition>
    <Transition name="fdp-slide">
      <div v-show="open" class="fdp-panel" role="dialog" @click.stop>
        <div class="fdp-head">
          <h2 class="fdp-title">plan ahead</h2>
          <button type="button" class="fdp-close" title="Close" @click="close">
            <X :size="18" />
          </button>
        </div>
        <VCalendar
          :attributes="dateAttributes"
          :min-date="minDate"
          expanded
          locale="en"
          :first-day-of-week="2"
          class="fdp-calendar"
          @dayclick="pickDate"
        />
        <FocusDateNav />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fdp-backdrop {
  position: fixed;
  inset: 0;
  background: var(--ink);
  opacity: 0.35;
  z-index: 10000;
}

.fdp-backdrop.fdp-backdrop-enter-active,
.fdp-backdrop.fdp-backdrop-leave-active {
  transition: opacity 0.2s ease-out;
}

.fdp-backdrop.fdp-backdrop-enter-from,
.fdp-backdrop.fdp-backdrop-leave-to {
  opacity: 0;
}

/* Roughly a third of the screen (see the request this was built for) —
   clamped so it stays usable at the narrow end of the tablet breakpoint
   and doesn't sprawl at the wide end. */
.fdp-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: clamp(260px, 34vw, 360px);
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: var(--bg);
  border-left: 2px solid var(--ink);
  box-shadow: -6px 0 0 var(--ink);
  padding: 20px 18px;
  overflow-y: auto;
  scrollbar-width: none;
  z-index: 10001;
}

.fdp-panel::-webkit-scrollbar {
  display: none;
}

/* Same settle as .tags-panel's own slide (layout.css) — decisive ease-out,
   no bounce/overshoot. */
.fdp-panel.fdp-slide-enter-active,
.fdp-panel.fdp-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.fdp-panel.fdp-slide-enter-from,
.fdp-panel.fdp-slide-leave-to {
  transform: translateX(100%);
}

.fdp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.fdp-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--ink-dark);
  font-family: var(--font-mono, monospace);
}

.fdp-close {
  background: none;
  border: none;
  color: var(--ink);
  opacity: 0.6;
  cursor: pointer;
  padding: 4px;
  transition: opacity 0.1s;
}

@media (hover: hover) {
  .fdp-close:hover {
    opacity: 1;
  }
}

.fdp-calendar {
  width: 100%;
}
</style>

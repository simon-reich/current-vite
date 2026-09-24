<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useThemeStore } from '../stores/theme'
import { todayStr } from '../composables/useToday'
import { activeModal } from '../composables/useModalGuard'
import FocusDateNav from './FocusDateNav.vue'
import ScrollDivider from './ScrollDivider.vue'

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

// Mirrors .mobile-tags-panel's own tags-scroll-divider (App.vue) — the
// calendar is sticky (see .fdp-sticky-head below), so the divider right
// under it is this panel's equivalent of that sticky header's bottom
// line, fading in once the Date-List nav has actually scrolled some of
// itself out from under the calendar.
const fdpPanelRef = ref<HTMLElement | null>(null)
const fdpScrolled = ref(false)
function onFdpScroll() {
  fdpScrolled.value = (fdpPanelRef.value?.scrollTop ?? 0) > 0
}

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
      <div v-show="open" ref="fdpPanelRef" class="fdp-panel" role="dialog" @click.stop @scroll="onFdpScroll">
        <div class="fdp-sticky-head">
          <!-- trim-weeks drops leading/trailing days from adjacent months
               as a whole extra row instead of just hiding their numbers
               (v-calendar's default) — that row was still taking up full
               height, which is what read as too much space above
               .fdp-scroll-divider below. -->
          <VCalendar
            :attributes="dateAttributes"
            :min-date="minDate"
            expanded
            trim-weeks
            locale="en"
            :first-day-of-week="2"
            class="fdp-calendar"
            @dayclick="pickDate"
          />
          <ScrollDivider class="fdp-scroll-divider" :visible="fdpScrolled" />
        </div>
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
  /* No top padding here anymore — it moved onto .fdp-sticky-head itself
     (see that rule) so the sticky calendar's own opaque box covers that
     whole band instead of leaving it as bare .fdp-panel padding above a
     sticky child, which is what let content scrolling up behind the
     calendar peek through above it before settling into place. */
  padding: 0 18px 20px;
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

/* Sticks the calendar (+ its own divider right below) to the top of
   .fdp-panel's scroll while the Date-List nav (FocusDateNav) scrolls
   underneath it — mirrors .mobile-tags-head's own sticky-header role in
   the tag panel. Grouping calendar + divider in one sticky wrapper means
   the divider always sits flush right under the calendar regardless of
   the calendar's own (expanded-month-dependent) height, no manual offset
   needed. z-index matches .mobile-tags-head's own. */
.fdp-sticky-head {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg);
  /* Matches #app's own 18px + .main-head's 14px (tablet.css) — moved here
     from .fdp-panel's own padding (see that rule's comment). */
  padding-top: 32px;
}

.fdp-calendar {
  width: 100%;
}

.fdp-scroll-divider {
  margin-top: 0;
}
</style>

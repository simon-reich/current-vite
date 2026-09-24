<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useThemeStore } from '../stores/theme'
import { useTodosStore } from '../stores/todos'
import { todayStr } from '../composables/useToday'
import { activeModal } from '../composables/useModalGuard'
import FocusDateNav from './FocusDateNav.vue'
import ScrollDivider from './ScrollDivider.vue'

// Tablet + phone alternative to DatePickerModal's plain centered calendar,
// opened by FocusDateWidget instead of that modal when its `panel` prop is
// set (see FocusDateWidget.vue) — desktop already has an always-visible
// Date-List nav in its own sidebar (App.vue's aside) and doesn't need
// this. Combines the plain calendar (any date) with the same today/
// tomorrow/preset-week/upcoming-lists nav the desktop sidebar already
// shows, via FocusDateNav.vue (single source of truth for all three). Also
// reused, calendar-less (showCalendar false), as Current's own phone
// list-picker — same Focus-Date-Pille, but tapping it there switches which
// Date List Current is showing (see FocusDateWidget.vue) instead of
// picking a "plan ahead" target.
//
// One shared component, but two distinctly different shapes below 1024px
// (see the `@media (max-width: 700px)` block at the bottom of the style):
// tablet keeps the original ~1/3-screen side panel sliding in from the
// right, calendar + Date-List nav as one continuous scrolling box. Phone
// instead splits into three separate floating widgets on the same
// translucent backdrop the Tag panel uses (mobile.css) — a standalone
// close button, a smaller calendar widget, and its own Date-List box below
// — a "control center" look with more of the dimmed Overview pool showing
// between them, rather than one big solid panel. Each widget itself stays
// opaque (unlike the Tag panel's fully transparent chips) since a
// calendar's day numbers need real contrast behind them to read at all.
// The whole group scales up from the screen's center on open ("zoom in").
//
// Stays mounted for as long as the pill that owns it exists (v-if="panel"
// on FocusDateWidget's own side) rather than being created fresh per open
// — `open` is a plain prop toggling v-show inside a Transition, which is
// what lets it actually slide in/out instead of just popping.
//
// Optional `modelValue`, same dual-mode pattern as FocusDateNav.vue's own
// (which this forwards it to below): defaults to driving the Focus-Date-
// Pille (themeStore.selectedFocusDate) when omitted — FocusDateWidget's own
// plain "plan ahead" instance never passes it, unchanged from before.
// `showCalendar` (default true): Current's phone list-picker instance
// (FocusDateWidget.vue) sets this false — it only ever needs the Date-List
// widget, not a date-picker calendar, and hiding it just gives that one
// widget the full vertical room instead (see .fdp-calendar-box's own v-if
// in the template — no separate layout needed for this, flex: 1 on
// .fdp-list-box already claims whatever room opens up).
const props = defineProps<{ open: boolean; modelValue?: string; showCalendar?: boolean }>()
const emit = defineEmits<{ close: []; 'update:modelValue': [dateStr: string] }>()
const themeStore = useThemeStore()
const store = useTodosStore()

const activeDate = computed<string>({
  get: () => props.modelValue ?? themeStore.selectedFocusDate,
  set: (dateStr) => {
    if (props.modelValue !== undefined) emit('update:modelValue', dateStr)
    else themeStore.setSelectedFocusDate(dateStr)
  },
})

function close() {
  emit('close')
}

function pickDate(day: { id: string }) {
  if (day.id < todayStr()) return
  activeDate.value = day.id
  scrollListToSelected()
}

// Picking a day in the calendar that's already one of the rendered
// Date-List entries below (today/tomorrow/preset-week always render,
// dimmed or not; further-out entries only render at all once a list
// actually exists there, see FocusDateNav.vue) scrolls it into view —
// `block: 'center'` (not 'nearest', which mostly just parked it flush at
// the bottom edge) so it lands somewhere legible mid-list instead.
// scrollIntoView itself already finds whichever ancestor actually scrolls
// (fdp-list-box on phone, the whole fdp-panel on tablet), so this needs no
// per-breakpoint branching. A no-op if nothing matches (already in view,
// or no such entry exists at all).
function scrollListToSelected() {
  nextTick(() => {
    const active = fdpListRef.value?.querySelector<HTMLElement>('.date-nav-btn.active, .date-nav-upcoming-chip.active')
    active?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}

// The reverse direction — picking a Date-List entry (FocusDateNav.vue's own
// v-model write, see below) jumps the calendar to that date's month.
// Watching activeDate directly covers both directions the same way
// scrollListToSelected covers its own — including the calendar's own
// pickDate above, where move()-ing to the month already on screen is just
// a harmless no-op. A no-op entirely when showCalendar is false (the ref
// just stays null, nothing to move).
const fdpCalendarRef = ref<any>(null)
watch(activeDate, (dateStr) => {
  fdpCalendarRef.value?.move(new Date(dateStr + 'T12:00:00'))
})

// Same dot type Calendar.vue's own "active" (done/worked-on) attribute
// uses — full-strength ink, not the dimmer "plannedActive" one Calendar.vue
// reserves for future planned days — marking exactly the days FocusDateNav
// below also renders un-dimmed (today plus every future date
// store.hasFocusDateList would return true for, see store.datesWithFocusList),
// so calendar and list stay in visual sync about which days actually have
// something on them.
const plannedDates = computed(() => store.datesWithFocusList.map(d => new Date(d + 'T12:00:00')))

const dateAttributes = computed(() => {
  const attrs: object[] = [{
    key: 'selected',
    highlight: {
      style: { backgroundColor: 'var(--ink-dark)', borderRadius: '4px' },
      contentStyle: { color: 'var(--bg)' },
    },
    dates: new Date(activeDate.value + 'T12:00:00'),
  }]
  if (plannedDates.value.length) {
    attrs.push({ key: 'planned', dot: { style: { backgroundColor: 'var(--ink)' } }, dates: plannedDates.value })
  }
  return attrs
})

const minDate = new Date(todayStr() + 'T00:00:00')

// Mirrors .mobile-tags-panel's own tags-scroll-divider (App.vue) — the
// calendar is sticky (see .fdp-sticky-head below), so the divider right
// under it is this panel's equivalent of that sticky header's bottom
// line, fading in once the Date-List nav has actually scrolled some of
// itself out from under the calendar. Tablet only — phone's calendar and
// list are two separate widgets, not one shared scroll container (see
// fdpListRef below).
const fdpPanelRef = ref<HTMLElement | null>(null)
const fdpScrolled = ref(false)
function onFdpScroll() {
  fdpScrolled.value = (fdpPanelRef.value?.scrollTop ?? 0) > 0
}

// Phone's own Date-List widget (.fdp-list-box) scrolls independently of
// the calendar widget above it — same "divider fades in once scrolled"
// cue as fdpScrolled above, just tracking this box's own scroll instead
// of the whole panel's.
const fdpListRef = ref<HTMLElement | null>(null)
const fdpListScrolled = ref(false)
function onFdpListScroll() {
  fdpListScrolled.value = (fdpListRef.value?.scrollTop ?? 0) > 0
}

// Phone's calendar widget drops the `expanded` prop below (see template) so
// it renders at the same compact, natural size DatePickerModal's own
// VCalendar already uses for "pick a date" everywhere else on phone — the
// request this was built for was explicitly "the size it already is when
// entering a date on a todo". Tablet keeps `expanded` (stretched to fill
// its side panel), same as before.
const PHONE_BREAKPOINT = 700
const isPhoneWidth = ref(window.innerWidth <= PHONE_BREAKPOINT)
function updateIsPhoneWidth() { isPhoneWidth.value = window.innerWidth <= PHONE_BREAKPOINT }
onMounted(() => window.addEventListener('resize', updateIsPhoneWidth))
onUnmounted(() => window.removeEventListener('resize', updateIsPhoneWidth))

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
        <!-- Standalone widget #1 — phone only (see .fdp-close-row's own
             media query below); tablet's side panel still just closes via
             the backdrop click, same as before. -->
        <div class="fdp-close-row">
          <button class="modal-btn modal-btn--cancel" @click="close">close</button>
        </div>

        <!-- Widget #2 on phone (its own opaque box, see .fdp-calendar-box
             below) — stays the sticky calendar header of tablet's single
             shared scroll box otherwise (.fdp-sticky-head, unchanged).
             Skipped entirely when showCalendar is false (Current's phone
             list-picker instance) — .fdp-list-box's flex: 1 then just
             claims the room this would have taken, no separate layout
             needed for the calendar-less case. -->
        <div v-if="showCalendar ?? true" class="fdp-sticky-head fdp-calendar-box">
          <!-- trim-weeks drops leading/trailing days from adjacent months
               as a whole extra row instead of just hiding their numbers
               (v-calendar's default) — that row was still taking up full
               height, which is what read as too much space above
               .fdp-scroll-divider below. -->
          <VCalendar
            ref="fdpCalendarRef"
            :attributes="dateAttributes"
            :min-date="minDate"
            :expanded="!isPhoneWidth"
            trim-weeks
            locale="en"
            :first-day-of-week="2"
            class="fdp-calendar"
            @dayclick="pickDate"
          />
          <ScrollDivider class="fdp-scroll-divider" :visible="fdpScrolled" />
        </div>

        <!-- Widget #3 on phone — its own opaque, independently scrolling
             box (.fdp-list-box below); display:contents on tablet folds it
             back out of the layout so FocusDateNav sits directly in
             .fdp-panel's own flex/scroll, exactly as before. -->
        <div ref="fdpListRef" class="fdp-list-box" @scroll="onFdpListScroll">
          <ScrollDivider class="fdp-list-scroll-divider" :visible="fdpListScrolled" />
          <FocusDateNav v-model="activeDate" />
        </div>
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

/* Tablet's side panel has no explicit close button (the backdrop click
   already closes it) — only phone's widget group below shows this row,
   same .modal-btn/.modal-btn--cancel look every other modal's close
   button uses. */
.fdp-close-row {
  display: none;
}

/* Folds this wrapper back out of the layout on tablet — FocusDateNav
   renders as if it were still a direct child of .fdp-panel, exactly as
   before this was split into separate widgets for phone (see below). */
.fdp-list-box {
  display: contents;
}

.fdp-list-scroll-divider {
  display: none;
}

/* Phone: three separate floating widgets on the shared translucent
   backdrop (.fdp-backdrop) instead of tablet's single ~1/3-screen side
   panel — a standalone close button, a smaller calendar widget, and its
   own Date-List box, each with its own opaque --bg surface (unlike the
   Tag panel's fully transparent chips — a calendar's day numbers need
   real contrast to read). More of the dimmed Overview pool shows between
   them than one big solid panel would leave, closer to a "control
   center" of individual widgets. --fdp-widget-width is the one shared
   size all three widgets use, so they read as one aligned column instead
   of three independently eyeballed widths. */
@media (max-width: 700px) {
  .fdp-panel {
    --fdp-widget-width: min(92vw, 380px);
    position: fixed;
    inset: 0;
    width: auto;
    display: flex;
    flex-direction: column;
    /* Left-aligned column by default — the Date-List box hugs the left
       edge (see its own rule below), and the calendar widget stretches to
       the full --fdp-widget-width from that same left edge, so the two
       line up. The close button is the one exception, pulled back to the
       right via its own align-self (see .fdp-close-row below). */
    align-items: flex-start;
    gap: 14px;
    padding: 24px 16px;
    background: transparent;
    border-left: none;
    overflow: visible;
    /* .fdp-panel itself now spans the full viewport (inset: 0 above) just
       to center its children — without this, its own empty, visually
       transparent space between/around the widgets would still swallow
       clicks meant for .fdp-backdrop underneath (its own @click.stop always
       fires first, being on top). Re-enabled on the three widgets
       themselves below, so touching the dimmed backdrop anywhere outside
       them still closes the menu, same as tablet's side panel. */
    pointer-events: none;
  }

  .fdp-close-row,
  .fdp-calendar-box,
  .fdp-list-box {
    pointer-events: auto;
  }

  /* The whole group scales up from the center of the screen on open
     ("zoom in") instead of tablet's slide from the side — .fdp-panel now
     spans the full viewport itself (children centered via flex, not a
     translate offset), so scaling it directly already scales from its
     own true center. */
  .fdp-panel.fdp-slide-enter-active,
  .fdp-panel.fdp-slide-leave-active {
    transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease-out;
  }

  .fdp-panel.fdp-slide-enter-from,
  .fdp-panel.fdp-slide-leave-to {
    transform: scale(0.85);
    opacity: 0;
  }

  .fdp-close-row {
    display: flex;
    /* Only this widget sits on the right — .fdp-panel's own align-items:
       flex-start (above) is what left-aligns the calendar/Date-List
       widgets below it. */
    align-self: flex-end;
  }

  /* Own opaque fill — every other close/cancel button (.modal-btn) is
     transparent by default, fine sitting on an opaque modal box, but this
     one floats directly on the translucent backdrop and needs its own
     surface to actually read there. */
  .fdp-close-row .modal-btn {
    background: var(--bg);
  }

  /* Widget #2: the calendar, its own compact opaque box now instead of a
     sticky header inside the shared scroll (tablet's .fdp-sticky-head
     role) — no longer sticky/scrolling itself, it's a fixed-size widget
     that never scrolls. Still spans the full --fdp-widget-width (unlike
     the close button/Date-List box, which only hug their own content) —
     the calendar itself renders at its plain, non-expanded size instead
     (see the `:expanded="!isPhoneWidth"` binding above), same size
     DatePickerModal's own calendar already uses elsewhere on phone, just
     centered within this wider card rather than stretched to fill it.
     Same box-shadow every other modal-style box in the app uses. */
  .fdp-sticky-head {
    position: static;
    width: var(--fdp-widget-width);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--bg);
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    padding: 16px;
    box-shadow: 6px 6px 0 var(--ink);
  }

  /* Tablet's own scroll-fade cue has no role here (the calendar doesn't
     scroll any more, see .fdp-sticky-head above) — .fdp-list-scroll-
     divider below takes over that job for the list widget instead. */
  .fdp-scroll-divider {
    display: none;
  }

  /* Widget #3: the Date-List nav, its own opaque box that scrolls on its
     own (see fdpListRef/onFdpListScroll). Only as wide as its widest row
     (width: max-content, capped at --fdp-widget-width as a safety net for
     an unusually long upcoming-date label) rather than the calendar's
     full card width — reads as its own compact widget, not a second copy
     of the calendar's card shape. flex: 1 still lets it claim whatever
     vertical room is left under the close button + calendar (height only,
     independent of its own width), keeping as many upcoming lists visible
     as the screen actually allows before anyone needs to scroll. Same
     box-shadow every other modal-style box in the app uses. */
  .fdp-list-box {
    display: flex;
    flex-direction: column;
    position: relative;
    width: max-content;
    max-width: var(--fdp-widget-width);
    flex: 1;
    min-height: 0;
    background: var(--bg);
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    padding: 14px 14px 16px;
    box-shadow: 6px 6px 0 var(--ink);
    overflow-y: auto;
    scrollbar-width: none;
  }

  .fdp-list-box::-webkit-scrollbar {
    display: none;
  }

  .fdp-list-scroll-divider {
    display: block;
    position: sticky;
    top: 0;
    margin-top: 0;
  }
}
</style>

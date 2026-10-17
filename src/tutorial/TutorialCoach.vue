<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { Check } from '@lucide/vue'
import { currentStep, stepNumber, stepCount, stepDone, stepDirection, nextStep, prevStep, endTutorial } from './useTutorial'

// The tutorial's coach card (centered) and whatever the current step points
// at gently pulsing (.tutorial-target, see the unscoped style below).
// Never blocks the app — the user does each step for real in the actual
// UI, the card just explains and waits.

const spot = ref<{ top: number; left: number; width: number; height: number } | null>(null)
const SPOT_PAD = 6

// How far an element's (outer) box-shadows reach past its border box on
// each side — counted into the target's area (the card keeps clear of the
// hard drop shadow too, add input/phone plus button). Computed style lists each
// shadow as "<color> x y blur spread".
function shadowExtent(el: HTMLElement) {
  const ext = { top: 0, right: 0, bottom: 0, left: 0 }
  const raw = getComputedStyle(el).boxShadow
  if (!raw || raw === 'none') return ext
  for (const shadow of raw.split(/,(?![^(]*\))/)) {
    if (shadow.includes('inset')) continue
    const [x = 0, y = 0, blur = 0, spread = 0] = (shadow.replace(/[a-z-]+\([^)]*\)|#[0-9a-f]+/gi, '').match(/-?[\d.]+px/g) ?? []).map(parseFloat)
    const reach = blur + spread
    ext.right = Math.max(ext.right, x + reach)
    ext.left = Math.max(ext.left, -x + reach)
    ext.bottom = Math.max(ext.bottom, y + reach)
    ext.top = Math.max(ext.top, -y + reach)
  }
  return ext
}

function findTarget(): HTMLElement | null {
  const target = currentStep.value?.target
  if (!target) return null
  for (const selector of Array.isArray(target) ? target : [target]) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (!el.getClientRects().length || el.offsetWidth <= 0) continue
      // Rendered but parked off-screen (the phone add sheet while closed).
      const r = el.getBoundingClientRect()
      if (r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth) return el
    }
  }
  return null
}

// The element currently marked as the target — the class moves along when
// the target changes (another breakpoint's control, the next step).
let markedEl: HTMLElement | null = null
// Re-checked every frame, not just on change: Vue rewrites an element's
// whole class attribute whenever its own :class binding changes (the add
// field's --open modifier as it unfolds), dropping this one with it.
function mark(el: HTMLElement | null) {
  if (el !== markedEl) {
    markedEl?.classList.remove('tutorial-target')
    markedEl = el
  }
  if (el && !el.classList.contains('tutorial-target')) el.classList.add('tutorial-target')
}

// Followed every frame while a step has a target: the target can move
// (input growing on focus, layout shifts, resizes, route transitions) and
// a frame-by-frame rect read is cheaper than wiring observers to all of it.
// Measured without the pulse's scale (offsetWidth/Height are untransformed).
let raf = 0
function track() {
  const el = findTarget()
  mark(el)
  if (el) {
    const r = el.getBoundingClientRect()
    const sh = shadowExtent(el)
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const w = el.offsetWidth, h = el.offsetHeight
    const next = {
      top: Math.round(cy - h / 2 - sh.top - SPOT_PAD),
      left: Math.round(cx - w / 2 - sh.left - SPOT_PAD),
      width: Math.round(w + sh.left + sh.right + SPOT_PAD * 2),
      height: Math.round(h + sh.top + sh.bottom + SPOT_PAD * 2),
    }
    const prev = spot.value
    if (!prev || prev.top !== next.top || prev.left !== next.left || prev.width !== next.width || prev.height !== next.height) spot.value = next
  } else if (spot.value) {
    spot.value = null
  }
  raf = requestAnimationFrame(track)
}

watch(() => currentStep.value?.target, (target) => {
  cancelAnimationFrame(raf)
  mark(null)
  spot.value = null
  if (target) raf = requestAnimationFrame(track)
}, { immediate: true })

// Enter clicks "next" — whenever it's enabled and the user isn't typing
// somewhere (there Enter belongs to the field: saving a todo, a sub, ...).
// Capture phase + stopImmediatePropagation so the app's own Enter (open
// the first card, see App.vue's onGlobalKeydown) doesn't fire as well.
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' || !currentStep.value || !stepDone.value) return
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
  const el = e.target as HTMLElement | null
  const tag = el?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || el?.isContentEditable) return
  e.preventDefault()
  e.stopImmediatePropagation()
  nextStep()
}
document.addEventListener('keydown', onKeydown, true)

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown, true)
  cancelAnimationFrame(raf)
  mark(null)
  window.removeEventListener('resize', onResize)
})

const viewport = ref({ w: window.innerWidth, h: window.innerHeight })
function onResize() { viewport.value = { w: window.innerWidth, h: window.innerHeight } }
window.addEventListener('resize', onResize)

// The card sits in the middle of the screen — unless that would cover the
// target, then it moves just below it (or above, if there's no room below).
const cardRef = ref<HTMLElement | null>(null)
const CARD_GAP = 24
const cardStyle = computed(() => {
  const r = spot.value
  const card = cardRef.value
  if (!r || !card) return undefined
  const { h } = viewport.value
  const ch = card.offsetHeight
  const centerTop = (h - ch) / 2
  const overlaps = centerTop < r.top + r.height + CARD_GAP && centerTop + ch + CARD_GAP > r.top
  if (!overlaps) return undefined
  const below = r.top + r.height + CARD_GAP
  const top = below + ch <= h - CARD_GAP ? below : Math.max(CARD_GAP, r.top - CARD_GAP - ch)
  return { top: top + 'px', transform: 'translateX(-50%)' }
})

const isFirst = computed(() => stepNumber.value === 1)
const isLast = computed(() => stepNumber.value === stepCount)
// A step the user completes by doing it gets a check popping in at its
// hint once done — the tutorial then moves on by itself (useTutorial.ts).
const showDoneMark = computed(() => !!currentStep.value?.done && stepDone.value)
</script>

<template>
  <Teleport to="body">
    <!-- One card for the whole tour: only its text swaps per step,
         sliding out and in the way the tour is going (stepDirection).
         Buttons keep focus where it is (mousedown.prevent) — clicking
         back/next mustn't pull the caret out of the add input. -->
    <Transition name="tutorial-card" appear>
      <div v-if="currentStep" ref="cardRef" class="tutorial-card" :style="cardStyle" role="dialog" :aria-label="currentStep.title">
        <div class="tutorial-card-top">
          <span class="tutorial-progress">{{ stepNumber }} / {{ stepCount }}</span>
          <button v-if="!isLast" class="tutorial-skip" @mousedown.prevent @click="endTutorial">skip tour</button>
        </div>

        <Transition :name="`tutorial-swipe-${stepDirection}`" mode="out-in">
          <div :key="currentStep.id" class="tutorial-content">
            <h2 class="tutorial-title">{{ currentStep.title }}</h2>
            <p class="tutorial-body">{{ currentStep.body }}</p>
            <p v-if="currentStep.hint" class="tutorial-hint" :class="{ 'tutorial-hint--done': showDoneMark }">
              <!-- Takes no room until done, then opens up in front of the
                   text while the check stamps down into it. -->
              <span class="tutorial-stamp-slot">
                <Check v-if="showDoneMark" class="tutorial-stamp" :size="20" :stroke-width="3.5" />
              </span>
              <span>{{ currentStep.hint }}</span>
            </p>
          </div>
        </Transition>

        <div class="tutorial-actions">
          <button v-if="!isFirst" class="modal-btn modal-btn--cancel modal-btn--pale" @mousedown.prevent @click="prevStep">back</button>
          <button
            class="modal-btn modal-btn--save"
            :disabled="!stepDone"
            @mousedown.prevent
            @click="nextStep"
          >{{ currentStep.nextLabel ?? 'next' }}</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Below the app's modals (10001) so a date picker or confirmation opened
   during a step still sits on top, above everything else. */
.tutorial-card {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9000;
  width: 380px;
  max-width: calc(100vw - 32px);
  background: var(--bg);
  color: var(--ink);
  border: 2px solid var(--ink);
  border-radius: var(--radius);
  box-shadow: var(--card-shadow-offset) var(--card-shadow-offset) 0 var(--ink);
  padding: 18px 20px 20px;
  /* Clips the text sliding in/out on a step change (the drop shadow is
     the box's own, unaffected). */
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tutorial-card-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.tutorial-progress,
.tutorial-skip {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  opacity: 0.5;
}

.tutorial-skip {
  background: none;
  border: none;
  padding: 0;
  color: var(--ink);
  cursor: pointer;
}

.tutorial-skip:hover {
  opacity: 0.9;
}

.tutorial-title {
  font-family: var(--font-playful, sans-serif);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.15;
  margin: 2px 0 0;
}

.tutorial-body {
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
}

/* The "now you" line — what to do in the app for this step. No box in
   front (it read as something to click); a check pops in once done. */
.tutorial-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tutorial-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0 0;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.tutorial-hint--done {
  opacity: 1;
}

.tutorial-stamp-slot {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 0;
  margin-right: -8px;
  transition: width 0.18s ease-out, margin-right 0.18s ease-out;
}

.tutorial-hint--done .tutorial-stamp-slot {
  width: 20px;
  margin-right: 0;
}

/* Like a stamp: comes down from big and see-through, hits its spot with a
   small overshoot and a slight tilt that settles. */
.tutorial-stamp {
  animation: tutorial-stamp 0.42s cubic-bezier(0.2, 0.8, 0.3, 1.2) both;
}

@keyframes tutorial-stamp {
  0% { opacity: 0; scale: 2.4; rotate: -18deg; }
  55% { opacity: 1; scale: 0.88; rotate: 4deg; }
  75% { scale: 1.08; rotate: -2deg; }
  100% { opacity: 1; scale: 1; rotate: 0deg; }
}

.tutorial-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}

/* The card itself only fades/pops in once at the start and out at the
   end — `scale`, not `transform`, which already does the centering. */
.tutorial-card-enter-active {
  transition: opacity 0.22s ease-out, scale 0.3s var(--ease-pop);
}
.tutorial-card-leave-active {
  transition: opacity 0.15s ease-in, scale 0.15s ease-in;
}
.tutorial-card-enter-from {
  opacity: 0;
  scale: 0.92;
}
.tutorial-card-leave-to {
  opacity: 0;
  scale: 0.97;
}

/* Step change: the text whooshes out one side and in from the other —
   left on forward, right on back. */
.tutorial-swipe-forward-enter-active,
.tutorial-swipe-back-enter-active {
  transition: opacity 0.18s ease-out, translate 0.22s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.tutorial-swipe-forward-leave-active,
.tutorial-swipe-back-leave-active {
  transition: opacity 0.12s ease-in, translate 0.12s ease-in;
}
.tutorial-swipe-forward-enter-from,
.tutorial-swipe-back-leave-to {
  opacity: 0;
  translate: 48px 0;
}
.tutorial-swipe-forward-leave-to,
.tutorial-swipe-back-enter-from {
  opacity: 0;
  translate: -48px 0;
}

/* Phone: full width minus the 16px gutters. */
@media (max-width: 700px) {
  .tutorial-card {
    width: calc(100vw - 32px);
    padding: 14px 16px 16px;
    gap: 8px;
  }

  .tutorial-title {
    font-size: 19px;
  }

  .tutorial-body {
    font-size: 13px;
  }
}
</style>

<style>
/* The step's target element itself, gently pulsing (unscoped: it's the
   app's own element). `scale`, so it never fights a transform the element
   already has. */
.tutorial-target {
  animation: tutorial-target-pulse 1.6s ease-in-out infinite;
}

@keyframes tutorial-target-pulse {
  0%, 100% { scale: 1; }
  50% { scale: 1.025; }
}
</style>

<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import TutorialStepText from './TutorialStepText.vue'
import { currentStep, stageSteps, stepNumber, stepCount, stepDone, canGoNext, stepDirection, nextStep, prevStep, endTutorial } from './useTutorial'

// The tutorial's coach card — always dead center, it never moves out of
// the way (tried, looked restless) — and whatever the current step points
// at gently pulsing (.tutorial-target, see the unscoped style below).
// Never blocks the app — the user does each step for real in the actual
// UI, the card just explains and waits.

function findTarget(): HTMLElement | null {
  const raw = currentStep.value?.target
  const target = typeof raw === 'function' ? raw() : raw
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
//
// The pulse grows small controls (buttons, the + circle) by a clearly
// visible PULSE_SMALL_PX, larger ones (inputs, lists) by PULSE_PX — a fixed
// scale would be invisible on the small ones and far too much on a
// full-width input — never below PULSE_MIN.
const SMALL_SIZE = 60
const PULSE_SMALL_PX = 4
const PULSE_PX = 10
const PULSE_MIN = 0.02
function mark(el: HTMLElement | null) {
  if (el !== markedEl) {
    markedEl?.classList.remove('tutorial-target')
    markedEl?.style.removeProperty('--tutorial-pulse-scale')
    markedEl = el
  }
  if (!el) return
  if (!el.classList.contains('tutorial-target')) el.classList.add('tutorial-target')
  const size = Math.max(el.offsetWidth, el.offsetHeight, 1)
  const grow = size < SMALL_SIZE ? PULSE_SMALL_PX / size : Math.max(PULSE_MIN, PULSE_PX / size)
  el.style.setProperty('--tutorial-pulse-scale', String(1 + grow))
}

// Followed every frame while a step has a target: the target can change
// (another breakpoint's control, an element re-rendered or swapped in) and
// a frame-by-frame lookup is cheaper than wiring observers to all of it.
let raf = 0
function track() {
  mark(findTarget())
  raf = requestAnimationFrame(track)
}

watch(() => currentStep.value?.target, (target) => {
  cancelAnimationFrame(raf)
  mark(null)
  if (target) raf = requestAnimationFrame(track)
}, { immediate: true })

// Enter clicks "next" — whenever it's enabled and the user isn't typing
// somewhere (there Enter belongs to the field: saving a todo, a sub, ...).
// Capture phase + stopImmediatePropagation so the app's own Enter (open
// the first card, see App.vue's onGlobalKeydown) doesn't fire as well.
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' || !currentStep.value || !canGoNext.value) return
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
      <div v-if="currentStep" class="tutorial-card" data-keeps-card-open role="dialog" :aria-label="currentStep.title">
        <div class="tutorial-card-top">
          <span class="tutorial-progress">{{ stepNumber }} / {{ stepCount }}</span>
          <button v-if="!isLast" class="tutorial-skip" @mousedown.prevent @click="endTutorial">skip tour</button>
        </div>

        <!-- The text area keeps one size through a whole stage (see
             TutorialStep.stage): every step of it is rendered invisibly
             in the same grid cell, so the cell — and the card — is as
             big as the biggest of them and doesn't resize per step. -->
        <div class="tutorial-stage">
          <TutorialStepText
            v-for="step in stageSteps"
            :key="'sizer-' + step.id"
            :step="step"
            done
            class="tutorial-sizer"
            aria-hidden="true"
          />
          <Transition :name="`tutorial-swipe-${stepDirection}`" mode="out-in">
            <TutorialStepText :key="currentStep.id" :step="currentStep" :done="showDoneMark" />
          </Transition>
        </div>

        <div class="tutorial-actions">
          <button v-if="!isFirst" class="modal-btn modal-btn--cancel" @mousedown.prevent @click="prevStep">back</button>
          <button
            class="modal-btn modal-btn--save"
            :disabled="!canGoNext"
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

@media (hover: hover) {
  .tutorial-skip:hover {
    opacity: 0.9;
  }
}

.tutorial-stage {
  display: grid;
}

.tutorial-stage > * {
  grid-area: 1 / 1;
}

.tutorial-sizer {
  visibility: hidden;
  pointer-events: none;
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
}
</style>

<style>
/* The step's target element itself, gently pulsing (unscoped: it's the
   app's own element). `scale`, so it never fights a transform the element
   already has; the amount is set per element (see mark() above). */
.tutorial-target {
  animation: tutorial-target-pulse 1.6s ease-in-out infinite;
}

@keyframes tutorial-target-pulse {
  0%, 100% { scale: 1; }
  50% { scale: var(--tutorial-pulse-scale); }
}

</style>

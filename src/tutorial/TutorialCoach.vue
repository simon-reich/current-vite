<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import TutorialStepText from './TutorialStepText.vue'
import { currentStep, stageSteps, stepNumber, stepCount, stepDone, canGoNext, stepDirection, nextStep, prevStep, endTutorial } from './useTutorial'

// The tutorial's coach card — always dead center, it never moves out of
// the way (tried, looked restless) — and whatever the current step points
// at gently pulsing (.tutorial-target, see the unscoped style below).
// Never blocks the app — the user does each step for real in the actual
// UI, the card just explains and waits.

// Extra emphasis for small targets (icons, the plus button, the tag +) on
// top of the pulse — large ones (inputs, lists) only pulse. Two variants
// to compare, switch here:
//  'ping'  sonar rings slowly running out from the target;
//  'flash' the target briefly turns inverted (ink fill, --bg icon) with a
//          shimmer sweeping across it.
const HIGHLIGHT = 'flash' as 'ping' | 'flash'

function findTarget(): HTMLElement | null {
  const raw = currentStep.value?.target
  const target = typeof raw === 'function' ? raw() : raw
  return target ? findFirst(target) : null
}

// The first element matching any of the selectors (in order) that is
// actually rendered on screen.
function findFirst(target: string | string[]): HTMLElement | null {
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
// 'flash' inverts a control that is a visible box (border or fill — the
// tag + circle, a framed button) as a whole; a bare icon (the tags icon in
// the bottom nav) has an invisible box around it, inverting that would
// flash a rectangle — there the icon's own shape fills in instead.
let flashClass: string | null = null
function flashKind(el: HTMLElement): string | null {
  if (HIGHLIGHT !== 'flash' || Math.max(el.offsetWidth, el.offsetHeight) >= SMALL_SIZE) return null
  const cs = getComputedStyle(el)
  const hasBox = parseFloat(cs.borderTopWidth) > 0 || !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(cs.backgroundColor)
  if (hasBox) return 'tutorial-target--flash'
  return el.querySelector('svg') ? 'tutorial-target--flash-icon' : 'tutorial-target--flash'
}

// Shimmer for a bare icon: an overlay over the icon, masked to the icon's
// own shape (the svg itself, filled, as a data-URL mask), with the same
// --bg band sweeping across it in step with the fill (same 3s cycle, see
// .tutorial-icon-shimmer).
const iconShimmer = ref<{ mask: string; left: number; top: number; width: number; height: number } | null>(null)
let iconMask: string | null = null

function svgMask(svg: SVGElement): string {
  const copy = svg.cloneNode(true) as SVGElement
  copy.setAttribute('fill', '#000')
  copy.setAttribute('stroke', '#000')
  copy.querySelectorAll('*').forEach(n => { n.setAttribute('fill', '#000'); n.setAttribute('stroke', '#000') })
  copy.removeAttribute('class')
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  return `url("data:image/svg+xml,${encodeURIComponent(copy.outerHTML)}")`
}

function updateIconShimmer(el: HTMLElement | null) {
  const svg = el && flashClass === 'tutorial-target--flash-icon' && !showDoneMark.value ? el.querySelector('svg') : null
  if (!svg) { if (iconShimmer.value) iconShimmer.value = null; return }
  iconMask ??= svgMask(svg)
  const r = svg.getBoundingClientRect()
  const prev = iconShimmer.value
  if (!prev || prev.left !== r.left || prev.top !== r.top || prev.width !== r.width || prev.height !== r.height) {
    iconShimmer.value = { mask: iconMask, left: r.left, top: r.top, width: r.width, height: r.height }
  }
}

function mark(el: HTMLElement | null) {
  if (el !== markedEl) {
    iconMask = null
    markedEl?.classList.remove('tutorial-target', 'tutorial-target--flash', 'tutorial-target--flash-icon')
    markedEl?.style.removeProperty('--tutorial-pulse-scale')
    markedEl = el
    flashClass = el ? flashKind(el) : null
  }
  if (!el) return
  if (!el.classList.contains('tutorial-target')) el.classList.add('tutorial-target')
  if (flashClass && !el.classList.contains(flashClass)) el.classList.add(flashClass)
  const size = Math.max(el.offsetWidth, el.offsetHeight, 1)
  const grow = size < SMALL_SIZE ? PULSE_SMALL_PX / size : Math.max(PULSE_MIN, PULSE_PX / size)
  el.style.setProperty('--tutorial-pulse-scale', String(1 + grow))
}

// The target's center and size on screen, for the ping overlay
// (fixed-positioned, so it isn't clipped by the target's containers).
const spot = ref<{ x: number; y: number; size: number } | null>(null)
function updateSpot(el: HTMLElement | null) {
  if (!el) { if (spot.value) spot.value = null; return }
  const r = el.getBoundingClientRect()
  const next = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), size: Math.max(el.offsetWidth, el.offsetHeight) }
  const prev = spot.value
  if (!prev || prev.x !== next.x || prev.y !== next.y || prev.size !== next.size) spot.value = next
}

// ── Card placement ──
// Centered by default (and always for steps with neither a target nor
// keepClear). When the
// centered card would cover what the step is about — its target, or the
// wider area it names in `keepClear` (e.g. the whole open todo) — it moves
// next to it instead: below if there's more room there, else above. Only
// then, never just to be close; moves are animated (top transition).
// Read without the pulse's scale (offset sizes around the rect's center),
// so the pulse never nudges the card.
const cardRef = ref<HTMLElement | null>(null)
const cardCenterY = ref<number | null>(null)
const CARD_GAP = 16

function clearRect(): { top: number; bottom: number; left: number; right: number } | null {
  const step = currentStep.value
  if (!step) return null
  const raw = step.keepClear ?? step.target
  const sel = typeof raw === 'function' ? raw() : raw
  const el = sel ? findFirst(sel) : null
  if (!el) return null
  const r = el.getBoundingClientRect()
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2
  return {
    top: cy - el.offsetHeight / 2, bottom: cy + el.offsetHeight / 2,
    left: cx - el.offsetWidth / 2, right: cx + el.offsetWidth / 2,
  }
}

// The part of the screen the card may use: the layout viewport minus the
// phone's bottom nav. Deliberately not the visual viewport — the card
// doesn't make way for an on-screen keyboard: the keyboard may cover it,
// but the card must never get pushed up over the field being typed into
// (what's typed matters more than the already-read hint).
function usableArea() {
  const top = 0
  let bottom = window.innerHeight
  const nav = document.querySelector<HTMLElement>('.mobile-bottom-nav')
  if (nav && nav.offsetWidth > 0) bottom = Math.min(bottom, nav.getBoundingClientRect().top)
  return { top, bottom }
}

// Kept while a target briefly disappears (the tags step once the tag is
// made), so the card doesn't hop back to the middle and over the todo.
let lastClear: ReturnType<typeof clearRect> = null

function placeCard() {
  const card = cardRef.value
  if (!card) return
  const { top, bottom } = usableArea()
  const ch = card.offsetHeight
  const center = top + (bottom - top) / 2
  let y = center
  const step = currentStep.value
  const clear = step?.target || step?.keepClear ? (clearRect() ?? lastClear) : null
  lastClear = clear
  // Covering means overlapping on both axes — a tall but narrow target off
  // to the side (Overview's tag column) doesn't count.
  const cw = card.offsetWidth
  const cardLeft = (window.innerWidth - cw) / 2
  const covers = !!clear
    && cardLeft < clear.right + CARD_GAP && cardLeft + cw > clear.left - CARD_GAP
    && center - ch / 2 < clear.bottom + CARD_GAP && center + ch / 2 > clear.top - CARD_GAP
  if (clear && covers) {
    const below = bottom - clear.bottom
    const above = clear.top - top
    y = below >= above
      ? Math.min(clear.bottom + CARD_GAP + ch / 2, bottom - CARD_GAP - ch / 2)
      : Math.max(clear.top - CARD_GAP - ch / 2, top + CARD_GAP + ch / 2)
  }
  y = Math.round(y)
  if (cardCenterY.value === null || Math.abs(cardCenterY.value - y) > 1) cardCenterY.value = y
}
const showPing = computed(() => HIGHLIGHT === 'ping' && !!spot.value && spot.value.size < SMALL_SIZE && !showDoneMark.value)

// Followed every frame while the tour runs: the target can change (another
// breakpoint's control, an element re-rendered or swapped in), the card's
// room too (keyboard, resize) — a frame-by-frame lookup is cheaper than
// wiring observers to all of it.
let raf = 0
function track() {
  const el = currentStep.value?.target ? findTarget() : null
  mark(el)
  updateSpot(el)
  updateIconShimmer(el)
  placeCard()
  raf = requestAnimationFrame(track)
}

watch(() => currentStep.value?.target, () => {
  mark(null)
  spot.value = null
  lastClear = null
})

watch(() => !!currentStep.value, (running) => {
  cancelAnimationFrame(raf)
  if (running) raf = requestAnimationFrame(track)
  else cardCenterY.value = null
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
    <div
      v-if="iconShimmer"
      class="tutorial-icon-shimmer"
      :style="{
        left: iconShimmer.left + 'px', top: iconShimmer.top + 'px',
        width: iconShimmer.width + 'px', height: iconShimmer.height + 'px',
        maskImage: iconShimmer.mask, '-webkit-mask-image': iconShimmer.mask,
      }"
    />

    <!-- Ping: three staggered rings around the target's center. -->
    <div
      v-if="showPing && spot"
      class="tutorial-ping"
      :style="{ left: spot.x + 'px', top: spot.y + 'px', '--ping-size': spot.size + 'px' }"
    >
      <span v-for="i in 3" :key="i" class="tutorial-ping-ring" :style="{ animationDelay: (i - 1) * 1 + 's' }" />
    </div>


    <!-- One card for the whole tour: only its text swaps per step,
         sliding out and in the way the tour is going (stepDirection).
         Buttons keep focus where it is (mousedown.prevent) — clicking
         back/next mustn't pull the caret out of the add input. -->
    <Transition name="tutorial-card" appear>
      <div v-if="currentStep" ref="cardRef" class="tutorial-card" data-keeps-card-open :style="cardCenterY !== null ? { top: cardCenterY + 'px' } : undefined" role="dialog" :aria-label="currentStep.title">
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
  /* Centered on its `top` (set from placeCard), so moving it is a plain,
     smoothly animated top change. */
  transform: translate(-50%, -50%);
  transition: top 0.35s cubic-bezier(0.2, 0.8, 0.3, 1);
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
  transition: opacity 0.22s ease-out, scale 0.3s var(--ease-pop), top 0.35s cubic-bezier(0.2, 0.8, 0.3, 1);
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

/* Above the app, below the card; never catches clicks. Anchored on the
   target's center (left/top), the rings offset themselves from there. */
.tutorial-ping {
  position: fixed;
  z-index: 8999;
  pointer-events: none;
}

/* Masked to the icon's shape (inline style); the band only shows during
   the fill stretch of the cycle, like the box flash's shimmer. */
.tutorial-icon-shimmer {
  position: fixed;
  z-index: 8999;
  pointer-events: none;
  mask-size: 100% 100%;
  -webkit-mask-size: 100% 100%;
  mask-repeat: no-repeat;
  -webkit-mask-repeat: no-repeat;
  background-image: linear-gradient(110deg, transparent 30%, var(--bg) 50%, transparent 70%);
  background-size: 250% 100%;
  background-repeat: no-repeat;
  opacity: 0;
  animation: tutorial-icon-shimmer 3s linear infinite;
}

@keyframes tutorial-icon-shimmer {
  0%, 61.9% { opacity: 0; background-position: 130% 0; }
  62% { opacity: 1; background-position: 130% 0; }
  88% { opacity: 1; background-position: -30% 0; }
  88.1%, 100% { opacity: 0; background-position: -30% 0; }
}

.tutorial-ping-ring {
  position: absolute;
  left: calc(var(--ping-size) / -2);
  top: calc(var(--ping-size) / -2);
  width: var(--ping-size);
  height: var(--ping-size);
  border: 3px solid var(--ink);
  border-radius: 50%;
  opacity: 0;
  animation: tutorial-ping 3s ease-out infinite;
}

@keyframes tutorial-ping {
  0% { opacity: 0.6; scale: 0.9; }
  100% { opacity: 0; scale: 2.4; }
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

/* Small targets, 'flash' variant: every few seconds briefly inverted (ink
   fill, --bg icon/text) while a --bg shimmer sweeps across, then back.
   Only the inverted stretch is written out — 0%/100% are left implicit so
   the element keeps its own background/color the rest of the time (an
   explicit "transparent" there would override e.g. a filled button). The
   steep easing on the way in/out turns the long implicit segments into a
   quick snap instead of a slow fade. In keyframes on purpose — animated
   values beat the element's own rules, whatever their specificity. */
.tutorial-target.tutorial-target--flash {
  animation:
    tutorial-target-pulse 1.6s ease-in-out infinite,
    tutorial-target-flash 3s cubic-bezier(0.95, 0, 1, 0.05) infinite;
}

@keyframes tutorial-target-flash {
  62% {
    background-color: var(--ink);
    color: var(--bg);
    background-image: linear-gradient(110deg, transparent 30%, var(--bg) 50%, transparent 70%);
    background-size: 250% 100%;
    background-repeat: no-repeat;
    background-position: 130% 0;
    animation-timing-function: linear;
  }
  88% {
    background-color: var(--ink);
    color: var(--bg);
    background-image: linear-gradient(110deg, transparent 30%, var(--bg) 50%, transparent 70%);
    background-size: 250% 100%;
    background-repeat: no-repeat;
    background-position: -30% 0;
    animation-timing-function: cubic-bezier(0, 0.95, 0.05, 1);
  }
}

/* Bare icon (no box of its own): the icon's shape fills in instead of
   its invisible box inverting — same timing as the box flash. */
.tutorial-target--flash-icon svg {
  animation: tutorial-icon-flash 3s cubic-bezier(0.95, 0, 1, 0.05) infinite;
}

@keyframes tutorial-icon-flash {
  62% { fill: currentColor; animation-timing-function: linear; }
  88% { fill: currentColor; animation-timing-function: cubic-bezier(0, 0.95, 0.05, 1); }
}

@keyframes tutorial-target-pulse {
  0%, 100% { scale: 1; }
  50% { scale: var(--tutorial-pulse-scale); }
}

</style>

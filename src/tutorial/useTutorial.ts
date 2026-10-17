import { computed, ref, watch } from 'vue'
import type { Router } from 'vue-router'
import { TUTORIAL_STEPS } from './steps'
import type { TutorialStep } from './types'
import { enterSandbox, exitSandbox, sandboxActive } from './sandbox'
import { startFocusTracking, stopFocusTracking } from './focus'
import { forgetSavedTodo } from './ui'

// Tutorial state — module-level, one tour for the whole app. The coach UI
// (TutorialCoach.vue) only renders this; steps themselves live in steps/.
const stepIndex = ref(0)
// Which way the last step change went — the card's text slides with it.
export const stepDirection = ref<'forward' | 'back'>('forward')
let router: Router | null = null

export const tutorialActive = sandboxActive
export const currentStep = computed(() => (tutorialActive.value ? TUTORIAL_STEPS[stepIndex.value] ?? null : null))
export const stepCount = TUTORIAL_STEPS.length
export const stepNumber = computed(() => stepIndex.value + 1)
export const stepDone = computed(() => currentStep.value?.done?.() ?? true)

// Once the user has done what a step asks, a short beat to see the result,
// then on to the next one.
const AUTO_ADVANCE_MS = 900
let advanceTimer: ReturnType<typeof setTimeout> | null = null
function clearAdvanceTimer() {
  if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null }
}

function openStep(index: number, direction: 'forward' | 'back' = 'forward') {
  clearAdvanceTimer()
  stepDirection.value = direction
  stepIndex.value = index
  const step = TUTORIAL_STEPS[index]
  if (!step) return
  if (step.route && router && router.currentRoute.value.path !== step.route) router.push(step.route)
  if (direction === 'back' && step.back) step.back()
  else step.enter?.()
  // Already done on arrival (e.g. the todo got saved during the previous
  // step's pause) — stepDone doesn't change then (forward always comes
  // from a done step), so the watch below wouldn't fire.
  if (direction === 'forward' && step.done?.()) completeStep(step)
}

function completeStep(step: TutorialStep) {
  step.onDone?.()
  clearAdvanceTimer()
  const delay = step.advanceMs ?? AUTO_ADVANCE_MS
  if (delay <= 0) nextStep()
  else advanceTimer = setTimeout(nextStep, delay)
}

watch(stepDone, (done) => {
  const step = currentStep.value
  if (done && step?.done) completeStep(step)
})

export function startTutorial(r: Router) {
  router = r
  if (!enterSandbox()) return
  startFocusTracking()
  openStep(0)
}

export function nextStep() {
  if (stepIndex.value >= TUTORIAL_STEPS.length - 1) endTutorial()
  else openStep(stepIndex.value + 1)
}

export function prevStep() {
  if (stepIndex.value > 0) openStep(stepIndex.value - 1, 'back')
}

export function endTutorial() {
  clearAdvanceTimer()
  stopFocusTracking()
  forgetSavedTodo()
  exitSandbox()
  stepIndex.value = 0
  router?.push('/all')
}

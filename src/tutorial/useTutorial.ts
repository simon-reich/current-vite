import { computed, ref, watch } from 'vue'
import type { Router } from 'vue-router'
import { TUTORIAL_STEPS } from './steps'
import type { TutorialStep } from './types'
import { enterSandbox, exitSandbox, sandboxActive } from './sandbox'
import { startFocusTracking, stopFocusTracking } from './focus'
import { forgetSavedTodo } from './ui'
import { forgetSeed } from './seed'
import { activeTagIds } from '../composables/useTagFilter'

// Tutorial state — module-level, one tour for the whole app. The coach UI
// (TutorialCoach.vue) only renders this; steps themselves live in steps/.
const stepIndex = ref(0)
// Which way the last step change went — the card's text slides with it.
export const stepDirection = ref<'forward' | 'back'>('forward')
let router: Router | null = null

export const tutorialActive = sandboxActive
export const currentStep = computed(() => (tutorialActive.value ? TUTORIAL_STEPS[stepIndex.value] ?? null : null))
// Every step of the current step's stage (see TutorialStep.stage).
const stageOf = (step: TutorialStep) => step.stage ?? step.route ?? step.id
export const stageSteps = computed(() => {
  const step = currentStep.value
  return step ? TUTORIAL_STEPS.filter(s => stageOf(s) === stageOf(step)) : []
})
export const stepCount = TUTORIAL_STEPS.length
export const stepNumber = computed(() => stepIndex.value + 1)
export const stepDone = computed(() => currentStep.value?.done?.() ?? true)
// Whether "next" is pressable: the step is done, or its action can be done
// for the user with what's already entered (see TutorialStep.redo/ready).
const canRedo = computed(() => {
  const step = currentStep.value
  return !!step?.redo && (step.ready?.() ?? true)
})
export const canGoNext = computed(() => stepDone.value || canRedo.value)

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
  if (direction === 'forward' && step.done?.() && !completedIds.has(step.id)) completeStep(step)
}

// Steps completed at least once this tour — arriving at one of those
// again (forward after going back) doesn't auto-complete it a second time;
// it just shows as done with "next" free.
const completedIds = new Set<string>()

function completeStep(step: TutorialStep) {
  completedIds.add(step.id)
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
  completedIds.clear()
  // Filters point at tag ids — the real ones don't exist in the sandbox
  // and the tour's don't outside it, so neither carries over.
  activeTagIds.value = []
  startFocusTracking()
  openStep(0)
}

export function nextStep() {
  const step = currentStep.value
  if (step && !stepDone.value) {
    // Not done yet — only reachable through canGoNext's redo case.
    if (canRedo.value) step.redo?.()
    return
  }
  if (stepIndex.value >= TUTORIAL_STEPS.length - 1) endTutorial()
  else openStep(stepIndex.value + 1)
}

export function prevStep() {
  if (stepIndex.value <= 0) return
  currentStep.value?.undo?.()
  openStep(stepIndex.value - 1, 'back')
}

export function endTutorial() {
  clearAdvanceTimer()
  stopFocusTracking()
  forgetSavedTodo()
  forgetSeed()
  activeTagIds.value = []
  exitSandbox()
  stepIndex.value = 0
  router?.push('/all')
}

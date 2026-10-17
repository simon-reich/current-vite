import type { TutorialStep } from '../types'
import { welcome } from './welcome'
import { firstTodo } from './firstTodo'
import { subs } from './subs'
import { finish } from './finish'

// The tour, in order — rearrange, add or drop steps here.
export const TUTORIAL_STEPS: TutorialStep[] = [
  welcome,
  firstTodo,
  subs,
  finish,
]

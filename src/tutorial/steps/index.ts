import type { TutorialStep } from '../types'
import { welcome } from './welcome'
import { firstTodo } from './firstTodo'
import { subs } from './subs'
import { openTodo } from './openTodo'
import { tags } from './tags'
import { moreTodos } from './moreTodos'
import { filter } from './filter'
import { finish } from './finish'

// The tour, in order — rearrange, add or drop steps here.
export const TUTORIAL_STEPS: TutorialStep[] = [
  welcome,
  firstTodo,
  subs,
  openTodo,
  tags,
  moreTodos,
  filter,
  finish,
]

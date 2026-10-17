import type { TutorialStep } from '../types'
import { welcome } from './welcome'
import { firstTodo } from './firstTodo'
import { subs } from './subs'
import { openTodo } from './openTodo'
import { tags } from './tags'
import { closeTodo } from './closeTodo'
import { moreTodos } from './moreTodos'
import { filter } from './filter'
import { planDay } from './planDay'
import { switchView } from './switchView'
import { currentView } from './currentView'
import { checkOff } from './checkOff'
import { finish } from './finish'

// The tour, in order — rearrange, add or drop steps here.
export const TUTORIAL_STEPS: TutorialStep[] = [
  welcome,
  firstTodo,
  subs,
  openTodo,
  tags,
  closeTodo,
  moreTodos,
  filter,
  planDay,
  switchView,
  currentView,
  checkOff,
  finish,
]

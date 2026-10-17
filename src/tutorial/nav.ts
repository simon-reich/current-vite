import { shallowRef } from 'vue'
import type { Router } from 'vue-router'

// The app's router, handed over when the tour starts (useTutorial.ts) —
// kept in its own module so steps can navigate and read the route without
// importing router/index.ts, which imports the views, one of which
// (Settings) imports the tour: a cycle.
export const tourRouter = shallowRef<Router | null>(null)

export function currentPath(): string | null {
  return tourRouter.value?.currentRoute.value.path ?? null
}

export function goTo(path: string) {
  const router = tourRouter.value
  if (router && router.currentRoute.value.path !== path) router.push(path)
}

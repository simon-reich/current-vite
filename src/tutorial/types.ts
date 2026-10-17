// One tutorial step — self-contained, so steps can be reordered, added or
// dropped just by editing the list in steps/index.ts.
export interface TutorialStep {
  id: string
  // Steps of one stage share one card size — the biggest of them — so the
  // card doesn't resize with every step. By default a stage is a view: all
  // steps with the same `route` (Overview, Current, Calendar, ...), so the
  // card only changes size where the view changes too. Set explicitly to
  // group differently; steps without a route stand on their own.
  stage?: string
  title: string
  // A sentence or two on what this part of the app is for.
  body: string
  // What to try right now ("type a todo and press enter"). Body and hint
  // may name an icon inline as {plus} — see TutorialStepText.vue.
  hint?: string
  // Route the step needs; the tutorial navigates there on entering.
  route?: string
  // Element(s) to point at. Several selectors for the same control on
  // different breakpoints (desktop input vs. phone plus button) — the
  // first one actually rendered on screen wins. Steps with a target also
  // get the soft dim cover with a cut-out around it.
  // A function for targets that move on within the step (the + first,
  // then the card's title to close it).
  target?: string | string[] | (() => string | string[])
  // What the coach card must not cover, if more than the target — e.g. the
  // whole open todo while the target is just its + (see placeCard in
  // TutorialCoach.vue). Same selector forms as target.
  keepClear?: string | string[] | (() => string | string[])
  // Reactive condition the user completes by doing the thing. While it's
  // false "next" stays disabled; once true the tutorial moves on by itself.
  // Steps without it are plain info steps with a "next" button.
  done?: () => boolean
  // Runs once when done() turns true, before moving on — e.g. tidying up
  // UI the user is still in (see ui.ts).
  onDone?: () => void
  // Setup when the step opens (seed extra todos, switch a setting, ...).
  enter?: () => void
  // Runs instead of enter() when the user comes back to this step via
  // "back" — puts the app back the way it was while this step was current
  // (e.g. a saved todo back into the input), so stepping back really undoes.
  back?: () => void
  // Lets "next" do the step's action for the user (e.g. Enter in the
  // field) — the step then completes as usual (stamp, pause, on). Only
  // while ready() holds: the minimum the action needs is in place (a title
  // typed, ...). Matters most after back, where the restored draft is
  // already there, but works the first time round too.
  redo?: () => void
  // Runs when leaving this step backwards — takes back what enter() set up
  // (seeded todos, ...), so the earlier step finds the app as it was.
  undo?: () => void
  ready?: () => boolean
  // Pause between done() turning true and the next step (default
  // AUTO_ADVANCE_MS in useTutorial.ts) — shorter where the user is already
  // busy with the next thing (e.g. typing subs right after the title);
  // 0 moves on immediately.
  advanceMs?: number
  // Label of the forward button (default "next").
  nextLabel?: string
}

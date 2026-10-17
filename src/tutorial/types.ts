// One tutorial step — self-contained, so steps can be reordered, added or
// dropped just by editing the list in steps/index.ts.
export interface TutorialStep {
  id: string
  title: string
  // A sentence or two on what this part of the app is for.
  body: string
  // What to try right now ("type a todo and press enter").
  hint?: string
  // Route the step needs; the tutorial navigates there on entering.
  route?: string
  // Element(s) to point at. Several selectors for the same control on
  // different breakpoints (desktop input vs. phone plus button) — the
  // first one actually rendered on screen wins. Steps with a target also
  // get the soft dim cover with a cut-out around it.
  target?: string | string[]
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
  // Pause between done() turning true and the next step (default
  // AUTO_ADVANCE_MS in useTutorial.ts) — shorter where the user is already
  // busy with the next thing (e.g. typing subs right after the title);
  // 0 moves on immediately.
  advanceMs?: number
  // Label of the forward button (default "next").
  nextLabel?: string
}

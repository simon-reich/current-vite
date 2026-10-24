<script lang="ts">
// Module-level: shared across all TodoCard instances so the bag persists
// between completions — see nextBgEffect below.
// These particles sit behind the whole app shell — visible in the page
// background and the gaps between panels/cards, hidden again wherever an
// opaque element (sidebar, menus, a card) paints on top — rather than
// overlaying and obscuring the UI while a celebration plays. z-index
// alone can't do this: #app is a plain, non-positioned box, and a fixed
// element's negative z-index stacks against the *root* context (behind
// <body>'s own background too, since body isn't its own stacking
// context) — invisible everywhere, not just behind #app. Prepending as
// body's first child instead relies on plain DOM paint order: earlier
// siblings paint first (further back), so this paints after body's
// background but before #app, with no z-index needed at all.
// Old particle-based celebrations (hearts/confetti/balloons/fireworks) —
// switched off again in favor of the frame-based SVG animations (cat/
// whale/penguin/orca etc., further down this file, see
// celebrateBackground's own comment). Kept defined here rather than
// deleted, same as the frame mechanics were while they were the inactive
// side of this same swap — either direction is meant to stay a two-line
// flip in celebrateBackground, not a rewrite. nextBgEffect/bgHearts/
// bgBalloons/bgConfetti/bgFireworks are `export`ed even though nothing
// outside this file uses them — same trick playFrameCelebration already
// relies on, since these are otherwise only ever called from
// celebrateBackground's own commented-out lines while inactive, and
// vue-tsc -b (unlike a plain --noEmit check) fails the build on an unused
// local function.
function particle(cx: number, cy: number, content: string, css: string): HTMLElement {
  const el = document.createElement('span')
  el.textContent = content
  el.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;pointer-events:none;user-select:none;` + css
  document.body.prepend(el)
  return el
}

type BgEffectName = 'hearts' | 'confetti' | 'balloons' | 'fireworks'
const bgEffectBag: BgEffectName[] = []

// Shuffle-bag instead of plain random: guarantees every effect turns up
// once per 4 completions instead of the same one occasionally repeating
// several times in a row, while still feeling random completion to
// completion (same trick as the old per-card burst used).
export function nextBgEffect(): BgEffectName {
  if (bgEffectBag.length === 0) {
    const bag: BgEffectName[] = ['hearts', 'confetti', 'balloons', 'fireworks']
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]]
    }
    bgEffectBag.push(...bag)
  }
  return bgEffectBag.pop()!
}

// Scales particle size/spread up for wider viewports — at mobile widths
// this is a no-op (clamped to 1), but on desktop the same fixed pixel
// sizes/distances used to look tiny and huddled in the middle of a much
// bigger screen instead of filling it.
function bgScale() {
  return Math.min(Math.max(window.innerWidth / 480, 1), 3.2)
}

export function bgHearts() {
  const w = window.innerWidth
  const h = window.innerHeight
  const scale = bgScale()
  for (let i = 0; i < 22; i++) {
    const cx = Math.random() * w
    const cy = h + 24 + Math.random() * 40
    const size = (16 + Math.random() * 14) * scale
    const rise = h * (0.55 + Math.random() * 0.5)
    const drift = (Math.random() - 0.5) * 140 * scale
    const dur = 1100 + Math.random() * 900
    const delay = Math.random() * 260
    const el = particle(cx, cy, '♥', `font-size:${size}px;color:var(--ink);transform:translate(-50%,-50%);`)
    // Movement and fade are two independent animations rather than one
    // keyframe list: a shared offset would force it to *finish moving* by
    // that point and then just sit there fading, when what we want is the
    // fade starting partway through, while it's still rising — the two
    // need their own independent timelines to do that.
    const transformAnim = el.animate(
      [
        { transform: 'translate(-50%,-50%)' },
        { transform: `translate(calc(-50% + ${drift}px), calc(-50% - ${rise}px)) scale(0.7)` },
      ],
      { duration: dur, delay, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
    )
    const fadeStart = dur * 0.5
    el.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: dur - fadeStart, delay: delay + fadeStart, easing: 'ease-in', fill: 'forwards' },
    )
    transformAnim.onfinish = () => el.remove()
  }
}

export function bgBalloons() {
  const w = window.innerWidth
  const h = window.innerHeight
  for (let i = 0; i < 16; i++) {
    const cx = Math.random() * w
    const cy = h + 24 + Math.random() * 40
    const size = 18 + Math.random() * 18
    const rise = h * (0.6 + Math.random() * 0.5)
    const drift = (Math.random() - 0.5) * 100
    const dur = 1400 + Math.random() * 900
    const delay = Math.random() * 260
    const el = document.createElement('span')
    el.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:${size}px;height:${size * 1.2}px;background:var(--ink);border-radius:50%;pointer-events:none;user-select:none;transform:translate(-50%,-50%);`
    document.body.prepend(el)
    // Movement and fade are independent animations — see bgHearts above
    // for why (fading needs to start partway through while it's still
    // rising, not just once it's already arrived and sitting still).
    const transformAnim = el.animate(
      [
        { transform: 'translate(-50%,-50%)' },
        { transform: `translate(calc(-50% + ${drift}px), calc(-50% - ${rise}px)) scale(0.6)` },
      ],
      { duration: dur, delay, easing: 'ease-out', fill: 'forwards' },
    )
    const fadeStart = dur * 0.5
    el.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: dur - fadeStart, delay: delay + fadeStart, easing: 'ease-in', fill: 'forwards' },
    )
    transformAnim.onfinish = () => el.remove()
  }
}

// Falls from above instead of rising, like actual confetti raining down —
// the other three effects all rise, this is the deliberate exception.
export function bgConfetti() {
  const w = window.innerWidth
  const h = window.innerHeight
  const scale = Math.min(bgScale(), 1.8)
  for (let i = 0; i < 40; i++) {
    const cx = Math.random() * w
    const cy = -24 - Math.random() * 60
    const cw = (5 + Math.random() * 4) * scale
    const ch = (9 + Math.random() * 7) * scale
    const initRot = Math.random() * 360
    const spin = initRot + (Math.random() > 0.5 ? 1 : -1) * (240 + Math.random() * 300)
    const fall = h + 80 + Math.random() * 60
    const drift = (Math.random() - 0.5) * 160
    const dur = 1300 + Math.random() * 900
    const delay = Math.random() * 400
    const el = document.createElement('span')
    el.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:${cw}px;height:${ch}px;background:var(--ink);border-radius:1px;pointer-events:none;user-select:none;transform:translate(-50%,-50%) rotate(${initRot}deg);`
    document.body.prepend(el)
    el.animate(
      [
        { transform: `translate(-50%,-50%) rotate(${initRot}deg)`, opacity: 1 },
        { transform: `translate(calc(-50% + ${drift}px), calc(-50% + ${fall}px)) rotate(${spin}deg)`, opacity: 1, offset: 0.94 },
        { transform: `translate(calc(-50% + ${drift}px), calc(-50% + ${fall}px)) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: dur, delay, easing: 'cubic-bezier(0.4, 0, 0.8, 1)', fill: 'forwards' },
    ).onfinish = () => el.remove()
  }
}

// A handful of firework bursts at random points in the upper screen — a
// rocket rises from the bottom into position first, then a ring of
// sparks radiates outward from there, genuinely explosive rather than a
// drifting/falling effect like the other three.
export function bgFireworks() {
  const w = window.innerWidth
  const h = window.innerHeight
  const scale = bgScale()
  // More bursts on wider screens, spread across nearly the full width —
  // like watching a whole skyline of fireworks from a rooftop instead of
  // a couple of bursts huddled in the middle. Launched within a fixed
  // total span (not a fixed gap per burst) so more bursts on a wide
  // screen means a denser show, not a longer one.
  const burstCount = Math.round((4 + Math.random() * 2) * Math.min(scale, 2.2))
  const launchSpan = 420 + Math.random() * 200
  for (let b = 0; b < burstCount; b++) {
    const bx = w * (0.05 + Math.random() * 0.9)
    const by = h * (0.18 + Math.random() * 0.32)
    const burstDelay = (b / Math.max(burstCount - 1, 1)) * launchSpan

    // Rocket: a single point rising from below the fold up to the burst
    // point, rather than the burst just appearing there instantly.
    const rocketRise = h - by + 20
    const rocketDur = 380 + Math.random() * 160
    const rocketSize = (5 + Math.random() * 3) * scale
    const rocket = document.createElement('span')
    rocket.style.cssText = `position:fixed;left:${bx}px;top:${h + 20}px;width:${rocketSize}px;height:${rocketSize * 2.4}px;background:var(--ink);border-radius:50%;pointer-events:none;user-select:none;transform:translate(-50%,-50%);`
    document.body.prepend(rocket)
    rocket.animate(
      [
        { transform: 'translate(-50%,-50%)', offset: 0 },
        { transform: `translate(-50%, calc(-50% - ${rocketRise}px))`, offset: 1 },
      ],
      { duration: rocketDur, delay: burstDelay, easing: 'ease-in', fill: 'forwards' },
    ).onfinish = () => rocket.remove()

    // Sparks burst once the rocket arrives.
    const sparkDelay = burstDelay + rocketDur
    const sparks = 16 + Math.floor(Math.random() * 8)
    for (let i = 0; i < sparks; i++) {
      const angle = (360 / sparks) * i + (Math.random() - 0.5) * 20
      const dist = (100 + Math.random() * 140) * scale
      const dx = Math.cos((angle * Math.PI) / 180) * dist
      const dy = Math.sin((angle * Math.PI) / 180) * dist
      const size = (8 + Math.random() * 5) * Math.min(scale, 1.15)
      const el = document.createElement('span')
      // opacity: 0 up front — a delayed WAAPI animation doesn't hide the
      // element during its own delay, it just doesn't move yet, so without
      // this every spark sat fully visible at the burst point the entire
      // time the rocket was still rising toward it. The first keyframe
      // below snaps it to visible right as the delay ends, so it truly
      // only appears at the moment of the burst.
      el.style.cssText = `position:fixed;left:${bx}px;top:${by}px;width:${size}px;height:${size}px;background:var(--ink);border-radius:50%;pointer-events:none;user-select:none;opacity:0;transform:translate(-50%,-50%);`
      document.body.prepend(el)
      el.animate(
        [
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.4)`, opacity: 0, offset: 1 },
        ],
        { duration: 550 + Math.random() * 300, delay: sparkDelay, easing: 'ease-out', fill: 'forwards' },
      ).onfinish = () => el.remove()
    }
  }
}

// Inlined (not <img>) so the fill can be overridden per path below — an
// <img src="...svg"> is opaque to CSS/JS, the markup has to actually be
// in the DOM. All paths render with the default SVG fill (black), so a
// single pass setting fill on each recolors every frame of the animation.
//
// Loaded via dynamic import rather than a static one: even after svgo,
// this text is way too big to bake into the main bundle that loads before
// anyone has completed a single todo. Rolldown splits each into its own
// chunk, fetched once on its first play and cached here for every one
// after — one promise cache per animation, keyed by loader function.
const frameSvgCache = new WeakMap<() => Promise<{ default: string }>, Promise<string>>()
function loadFrameSvg(importer: () => Promise<{ default: string }>): Promise<string> {
  let promise = frameSvgCache.get(importer)
  if (!promise) {
    promise = importer().then((m) => m.default)
    frameSvgCache.set(importer, promise)
  }
  return promise
}

// Three breakpoint tiers, each with its own hand-exported artwork (not
// just a scaled-up/-down version of one file — frame count/timing can
// differ between tiers, see CelebrationVariant.fallbackCycleMs) at
// src/assets/animations/svg/<name>_<width>.svg, matching the app's own
// existing breakpoints (700px mobile/tablet split, 1024px tablet/desktop
// split — see mobile.css/layout.css) rather than inventing new ones.
// Shared with the swipe zones' per-tier triangle sizes (ZONE_LAYOUT).
type ViewportTier = 'phone' | 'tablet' | 'desktop'

function currentViewportTier(): ViewportTier {
  const w = window.innerWidth
  if (w <= 700) return 'phone'
  if (w <= 1024) return 'tablet'
  return 'desktop'
}

interface CelebrationVariant {
  importer: () => Promise<{ default: string }>
  // Fallback only (used if getAnimations() isn't available) — must match
  // the cycle duration baked into that tier's own SVG <style> (e.g.
  // "2.97s" -> 2970). Tracked per tier, not just per celebration: the
  // desktop/tablet/phone exports of the same celebration don't always
  // share one duration.
  fallbackCycleMs: number
}

interface CelebrationConfig {
  variants: Record<ViewportTier, CelebrationVariant>
  verticalAnchor?: 'center' | 'bottom'
}

// Builds and styles the overlay + inlined SVG shared by both a real play
// (playFrameCelebration) and the pre-completion teaser
// (showCelebrationTeaser) below — same sizing/positioning either way, only
// what happens to its opacity/animations afterward differs.
//
// Sizing is "cover", not "contain": every tier's artwork always fills the
// entire overlay on both axes, cropped rather than letterboxed on
// whichever axis it doesn't naturally match — same idea as CSS
// background-size:cover/object-fit:cover, just computed by hand since an
// inlined <svg> (needed so its paths can be recolored, see the comment
// above loadFrameSvg) doesn't get either of those for free. Scale is
// derived from the SVG's own viewBox, not the tier's nominal pixel width,
// so this keeps working correctly even if a future export's viewBox
// doesn't exactly match its filename's width.
function buildFrameOverlay(svgRaw: string, config: CelebrationConfig): { overlay: HTMLDivElement; svg: SVGElement | null } {
  const { verticalAnchor = 'center' } = config
  const overlay = document.createElement('div')
  // No z-index — same trick as the old particle() helper above: #app is
  // a plain, non-positioned box and body isn't its own stacking context
  // either, so a fixed element's z-index would stack against the *root*
  // context and end up invisible everywhere, not just behind the cards.
  // Prepending as body's first child instead relies on plain DOM paint
  // order: earlier siblings paint first (further back), so this paints
  // after body's background but before #app — behind every card, menu,
  // and panel, without needing any z-index at all.
  //
  // A 'bottom'-anchored celebration paints behind #app (see above), which
  // includes the mobile bottom nav (fixed, 60px, see .mobile-bottom-nav in
  // mobile.css) — flush against the true viewport bottom otherwise sits
  // half-hidden underneath it. Same mobile breakpoint (700px) that CSS
  // itself uses, checked fresh per build rather than tracked reactively —
  // this overlay is short-lived and torn down right after, so there's
  // nothing to keep in sync across a resize. Shrinking the overlay's own
  // box (rather than just nudging the svg) means the cover-scale
  // calculation below sees the same, smaller viewport the crop is
  // actually happening against.
  const bottomInsetPx = verticalAnchor === 'bottom' && window.innerWidth <= 700 ? 60 : 0
  overlay.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:${bottomInsetPx}px;overflow:hidden;pointer-events:none;`
  overlay.innerHTML = svgRaw
  const svg = overlay.querySelector('svg')
  if (svg) {
    const viewBox = svg.viewBox.baseVal
    const naturalWidth = viewBox?.width || svg.width.baseVal.value
    const naturalHeight = viewBox?.height || svg.height.baseVal.value
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight - bottomInsetPx
    const scale = Math.max(viewportWidth / naturalWidth, viewportHeight / naturalHeight)
    const scaledWidth = naturalWidth * scale
    const scaledHeight = naturalHeight * scale
    const left = (viewportWidth - scaledWidth) / 2
    const top = verticalAnchor === 'bottom' ? viewportHeight - scaledHeight : (viewportHeight - scaledHeight) / 2
    svg.style.cssText = `display:block;position:absolute;left:${left}px;top:${top}px;width:${scaledWidth}px;height:${scaledHeight}px;`
    svg.querySelectorAll('path').forEach((p) => p.setAttribute('fill', 'var(--ink)'))
  }
  return { overlay, svg }
}

// Plays one of the step-end/visibility-toggling frame animations from
// src/assets/animations/ (see the "Celebration-Animationen" section in
// CLAUDE.md for how new ones are added) as a full-viewport background
// overlay, then removes it once the animation completes.
// Exported (not otherwise necessary) only so it survives noUnusedLocals
// while celebrateBackground's own call to it is commented out — see that
// function's comment.
export async function playFrameCelebration(config: CelebrationConfig) {
  const variant = config.variants[currentViewportTier()]
  const svgRaw = await loadFrameSvg(variant.importer)
  const { overlay, svg } = buildFrameOverlay(svgRaw, config)
  document.body.prepend(overlay)
  // Removal used to be a plain setTimeout racing against the step-end
  // keyframes, which are baked into these SVGs as `infinite` (they loop
  // forever on their own). If that timer ever fired even slightly late —
  // main thread busy for a tick — the animation had already looped back
  // to its 0% keyframe and painted frame one again before the timeout
  // caught up, flashing the start of the animation right at the end.
  // Capping every animation at exactly 1 iteration via the Web Animations
  // API and awaiting the browser's own `finished` promise removes the race
  // entirely: there's no second iteration left to loop into, and removal
  // happens exactly when the animation itself reports done, not whenever a
  // JS timer happens to wake up.
  const animations = (svg ?? overlay).getAnimations?.({ subtree: true }) ?? []
  // Cap iterations *before* reading endTime below — the CSS declares
  // these `infinite`, so getComputedTiming().endTime would itself still
  // read as Infinity if asked before this.
  animations.forEach((a) => a.effect?.updateTiming({ iterations: 1 }))
  // Real duration of the now-capped frame loop, not the fallbackCycleMs
  // guess — the fade below has to span exactly this or its own fade-out
  // tail would either cut off early (still opaque) or run past removal.
  const totalDuration = animations.length
    ? Number(animations[0]?.effect?.getComputedTiming().endTime ?? variant.fallbackCycleMs)
    : variant.fallbackCycleMs
  // One continuous opacity animation for the whole celebration — fades in
  // over its first ~150ms, holds, fades out over its last ~150ms. This is
  // deliberately a single animate() call spanning the full duration
  // (matching how the very first version of this celebration did it)
  // rather than two separate fade-in/fade-out calls: that split version
  // never visibly faded at all in testing, for reasons neither of us
  // pinned down — this simpler, single-timeline version is the one
  // that's actually confirmed to have worked before.
  const fadeFraction = Math.min(0.3, 150 / totalDuration)
  overlay.animate(
    [
      { opacity: 0 },
      { opacity: 1, offset: fadeFraction },
      { opacity: 1, offset: 1 - fadeFraction },
      { opacity: 0 },
    ],
    { duration: totalDuration, easing: 'linear', fill: 'forwards' },
  )
  if (animations.length) {
    await Promise.allSettled(animations.map((a) => a.finished))
  } else {
    await new Promise((resolve) => setTimeout(resolve, variant.fallbackCycleMs))
  }
  overlay.remove()
}

// Every available frame-animation celebration, keyed by name — see the
// "Celebration-Animationen" section in CLAUDE.md before adding another.
// Which key a given todo gets is decided once, in stores/todos.ts's
// sendToCurrent (see Todo.celebration and useCelebrations.ts) — not here;
// this map only knows how to actually render a given key. Each celebration
// needs all three tiers (desktop/tablet/phone, see ViewportTier) —
// there's no single-tier fallback, since a viewport can only ever ask for
// its own tier.
const ALL_CELEBRATIONS: Record<CelebrationKey, CelebrationConfig> = {
  blackCat: {
    variants: {
      desktop: { importer: () => import('../assets/animations/svg/cat-black_1920.svg?raw'), fallbackCycleMs: 3780 },
      tablet: { importer: () => import('../assets/animations/svg/cat-black_810.svg?raw'), fallbackCycleMs: 3360 },
      phone: { importer: () => import('../assets/animations/svg/cat-black_486.svg?raw'), fallbackCycleMs: 3150 },
    },
  },
  // Currently out of the pool — see CELEBRATION_KEYS in useCelebrations.ts.
  // whale: {
  //   variants: {
  //     desktop: { importer: () => import('../assets/animations/svg/whale-05_1920.svg?raw'), fallbackCycleMs: 1680 },
  //     tablet: { importer: () => import('../assets/animations/svg/whale-05_810.svg?raw'), fallbackCycleMs: 1680 },
  //     phone: { importer: () => import('../assets/animations/svg/whale-05_486.svg?raw'), fallbackCycleMs: 1680 },
  //   },
  // },
  penguin: {
    // Anchored to the bottom instead of vertically centered like
    // cat/whale — a penguin standing on the "ground" reads better than
    // one floating mid-screen, and stays true even scaled up to cover the
    // viewport (see buildFrameOverlay's verticalAnchor handling).
    variants: {
      desktop: { importer: () => import('../assets/animations/svg/pinguin_1920.svg?raw'), fallbackCycleMs: 2970 },
      tablet: { importer: () => import('../assets/animations/svg/pinguin_810.svg?raw'), fallbackCycleMs: 2970 },
      phone: { importer: () => import('../assets/animations/svg/pinguin_486.svg?raw'), fallbackCycleMs: 2970 },
    },
    verticalAnchor: 'bottom',
  },
  orca: {
    variants: {
      desktop: { importer: () => import('../assets/animations/svg/orca-01_1920.svg?raw'), fallbackCycleMs: 8760 },
      tablet: { importer: () => import('../assets/animations/svg/orca-01_810.svg?raw'), fallbackCycleMs: 8760 },
      phone: { importer: () => import('../assets/animations/svg/orca-01_486.svg?raw'), fallbackCycleMs: 8760 },
    },
  },
}

// Takes a stored key as-is — possibly retired from CELEBRATION_KEYS or
// missing — and lets ensureCelebrationKey (useCelebrations.ts) settle it,
// so there's never an undefined config to render.
function resolveCelebrationConfig(key: string | undefined): CelebrationConfig {
  return ALL_CELEBRATIONS[ensureCelebrationKey(key)]
}

// Pre-completion teaser — see the Current check-menu's showMenu watch in
// <script setup> below. Shows the given (already-assigned, see
// ALL_CELEBRATIONS' own comment) celebration's very first frame, frozen
// (not playing) and pale via opacity (not a separate color — see
// CLAUDE.md's four-color rule), while the Done/Done-for-now choice is
// still open, so the real celebration on actually completing doesn't come
// out of nowhere. Only one can ever be showing at a time (openCheckMenuId
// is a single shared ref app-wide).
const TEASER_OPACITY = 0.35
let teaserOverlay: HTMLDivElement | null = null
let teaserToken = 0

// Exported (not just called from this file's own watch(showMenu, ...) —
// see App.vue's single openCheckMenuId watcher instead: cycleOpenCard sets
// openCheckMenuId straight to the next card in one ref assignment, and two
// *different* TodoCard instances' own watch(showMenu, ...) callbacks then
// raced each other over this shared teaser state, in whatever order Vue
// happened to flush them (registration/list order, unrelated to which
// direction you were cycling) — cycling backward reliably hit the order
// where the new card's still-loading show() got cancelled by the old
// card's hide() before it ever got to render. A single watcher owned by
// one place, driven by the one ref both transitions share, has no such
// race to lose.
export async function showCelebrationTeaser(key: string | undefined) {
  const token = ++teaserToken
  const config = resolveCelebrationConfig(key)
  const svgRaw = await loadFrameSvg(config.variants[currentViewportTier()].importer)
  // Superseded by a newer show/hide call (menu closed again, or a
  // different card's opened) while the SVG was still loading.
  if (token !== teaserToken) return
  const { overlay, svg } = buildFrameOverlay(svgRaw, config)
  overlay.style.opacity = '0'
  document.body.prepend(overlay)
  // Freezes on frame 0 (its own 0%-visible keyframe) by pausing every
  // frame animation the instant they exist, before any of them have had a
  // chance to advance — these start running immediately on insertion
  // regardless of anything JS does (see playFrameCelebration).
  const animations = (svg ?? overlay).getAnimations?.({ subtree: true }) ?? []
  animations.forEach((a) => a.pause())
  overlay.animate([{ opacity: 0 }, { opacity: TEASER_OPACITY }], { duration: 150, easing: 'ease-out', fill: 'forwards' })
  teaserOverlay = overlay
}

export function hideCelebrationTeaser() {
  teaserToken++ // cancels an in-flight showCelebrationTeaser() still loading
  const overlay = teaserOverlay
  teaserOverlay = null
  overlay?.remove()
}

// Full-viewport celebration for completing a todo (Done or Done for
// today — no hierarchy between the two, both get the same treatment).
// `key` is the todo's own already-assigned celebration (see
// ALL_CELEBRATIONS' comment) — not drawn here, so it always matches
// whatever the pre-completion teaser just showed for that same todo.
//
// Switched back to the frame-animation celebrations (Cat/Whale/Penguin/
// Orca) — the old particle-based shuffle-bag (hearts/confetti/balloons/
// fireworks) stays defined above, just commented out here rather than
// ripped out, the same swap in reverse from when it was last switched off.
export function celebrateBackground(key: string | undefined) {
  hideCelebrationTeaser()
  playFrameCelebration(resolveCelebrationConfig(key))
  // const effect = nextBgEffect()
  // if (effect === 'hearts') bgHearts()
  // else if (effect === 'confetti') bgConfetti()
  // else if (effect === 'balloons') bgBalloons()
  // else bgFireworks()
}

import { ref as vueRef, nextTick as vueNextTick } from 'vue'
import { ensureCelebrationKey, type CelebrationKey } from '../composables/useCelebrations'
// Shared across all instances – only one menu open at a time. Exported so
// App.vue's single ↑↓ handler can tell whether a card is currently open
// (and cycle between cards instead of scrolling/doing nothing) or closed.
export const openTagMenuId = vueRef<string | null>(null)
export const openCheckMenuId = vueRef<string | null>(null)

// Descriptor the currently-open card registers itself with (see the
// showMenu/showTagMenu watch in <script setup> below) — lets a single
// document-level ↑↓ handler (App.vue) drive card-to-card cycling without
// needing its own listener per card. Previously each open card attached its
// own 'keydown' listener and handled this itself, entirely independently of
// App.vue's view-cycling listener; nothing stopped both from existing at
// once, and since cycling always lands on *some* card (never closes one),
// once any card opened, that could silently keep driving card-cycling
// forever instead of view-switching, with no way to tell from the outside.
interface ActiveCardApi {
  todoId: string
  mode: 'all' | 'current'
  getSiblingIds: () => string[] | undefined
  isEditing: () => boolean
  saveEdit: () => void
}
const activeCardApi = vueRef<ActiveCardApi | null>(null)

// ↑↓ jump to the next/previous card in the list. App.vue only calls this
// while the title textarea isn't focused (↑↓ have to stay free to move the
// cursor between lines there instead) — so wasEditing below is really just
// a safety net (save whatever's typed rather than lose it) for the rare
// case isEditing is still true despite that, not something this relies on
// to carry an edit forward to the next card the way Tab-cycling used to;
// that carry-over is gone along with Tab's old role here (see CLAUDE.md).
// A Current card whose tag/date editor is open (see openEditFromCurrent)
// counts as "open the editor" too, not "open the check-menu" — otherwise
// cycling out of a Current edit landed back on the check-menu's
// Done/Done-for-now row instead.
export function cycleOpenCard(direction: 1 | -1) {
  const api = activeCardApi.value
  if (!api) return
  const ids = api.getSiblingIds()
  if (!ids || ids.length < 2) return
  const idx = ids.indexOf(api.todoId)
  if (idx === -1) return
  const nextId = ids[(idx + direction + ids.length) % ids.length]
  const wasTagMenuOpen = openTagMenuId.value === api.todoId
  if (api.isEditing()) api.saveEdit()
  if (api.mode === 'current' && !wasTagMenuOpen) openCheckMenuId.value = nextId
  else openTagMenuId.value = nextId
  revealCard(nextId)
}

// Keyboard-driven focus jumps (↑↓ cycling, C moving on to the next card)
// keep the newly opened card on screen — only scrolls when it isn't fully
// visible already ('nearest'). Waits a frame so the card's opened (taller)
// layout is what gets measured.
export function revealCard(id: string | null) {
  if (!id) return
  vueNextTick(() => requestAnimationFrame(() => {
    document.querySelector(`.todo-card[data-todo-id="${id}"]`)
      ?.closest('.todo-card-wrap')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }))
}

// Called by App.vue on every view change, so a card left open (or mid-edit)
// never survives a switch away — coming back to a view should never show
// something still open or half-typed.
export function closeActiveCard() {
  if (activeCardApi.value?.isEditing()) activeCardApi.value.saveEdit()
  openTagMenuId.value = null
  openCheckMenuId.value = null
}
</script>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted, inject, type Ref } from 'vue'
import { CirclePlus, CircleMinus, CircleArrowRight, Trash2, CheckCheck, Clock, Check, Flag, RefreshCw, GripVertical, X, ChevronUp, ChevronDown, ArrowUpRight } from '@lucide/vue'
import { motion, useMotionValue, useTransform, useMotionValueEvent, animate, type PanInfo } from 'motion-v'
import { useTodosStore, type Todo, type Sub, type LoopInterval, type Tag, PRIORITY_TAG_ID, LOOP_TAG_ID } from '../stores/todos'
import { useThemeStore } from '../stores/theme'
import { onQuickExpandEnter, onQuickExpandLeave } from '../composables/useQuickExpand'
import { activeModal } from '../composables/useModalGuard'
import { requestTodoDraft } from '../composables/useTodoDraftRequest'
import { sandboxActive } from '../tutorial/sandbox'
import { runLoopSchedule, isLoopDueToday, isLoopSettledToday } from '../composables/useLoopSchedule'
import { shrinkFontToFit } from '../composables/useFitFont'
import { burstCheckbox } from '../composables/useCheckboxBurst'
import { todayStr, tomorrowStr, addDaysStr, localDayOf, appDate, WEEKDAY_FULL_LABELS } from '../composables/useToday'
import { useListFlip } from '../composables/useListFlip'
import LoopPicker from './LoopPicker.vue'
import TagInlineCreate from './TagInlineCreate.vue'
import LinkifiedText from './LinkifiedText.vue'

const props = defineProps<{
  todo: Todo
  mode: 'all' | 'current'
  font?: string
  /** Ids of every todo in the current list, in render order — lets Tab/
   *  Shift+Tab jump straight to the next/previous card while one is open. */
  siblingIds?: string[]
  /** Position in the current list — staggers the mount-in bounce so cards
   *  settle one after another instead of all at once. Ignored in grid mode. */
  index?: number
  /** Overview (both its grid and list toggle) vs. Current. In this mode the
   *  whole pool of todos surfaces together instead of marching in one-by-
   *  one — closer to how the pool concept reads: an undifferentiated
   *  collection, not a sequence. Current keeps the marching-in stagger since
   *  it's a deliberately curated, ordered subset instead. */
  gridMode?: boolean
  /** Current's own "expand all subs" toggle (see Current.vue) — forces the
   *  sub-list open even while the card itself is closed, without also
   *  opening the Done/Done-for-now menu. 'half' shows only unchecked
   *  subs — already-done ones are only ever revealed per-card, via the "N
   *  done" hint next to that card's own sub-list (see toggleDoneSubsReveal). */
  forceExpandSubs?: 'half' | 'off'
  /** Current's "Lists" panel previewing a future Date List (see
   *  ListsPanel.vue) — same mode="today" card, but Done/Done-for-now are
   *  locked out until that date is actually today; removing from the list
   *  still works normally. */
  previewLocked?: boolean
}>()

// Entrance bounce when a card first mounts (a fresh view, a newly created
// todo, a filter revealing it again). List layout staggers by position so
// cards settle in one after another; grid layout gives every card its own
// small random jitter instead — reads as the whole pool surfacing at once
// rather than a mechanical sequence, while still avoiding a dead-flat sync.
const enterDelay = props.gridMode
  ? Math.random() * 0.12
  : Math.min((props.index ?? 0) * 0.035, 0.35)
const enterInitial = props.gridMode
  ? { opacity: 0, y: 0, scale: 0.75 }
  : { opacity: 0, y: 16, scale: 0.9 }
const ENTER_SPRING = { type: 'spring', stiffness: 700, damping: 24, mass: 0.6 } as const

const store = useTodosStore()
const themeStore = useThemeStore()

const isPriority = computed(() => props.todo.tags.includes(PRIORITY_TAG_ID))
const isLoop = computed(() => props.todo.tags.includes(LOOP_TAG_ID))
// Both once and loop share the same Date tag (isLoop) — this narrows to
// just the recurring case, for the small corner badge that's the only
// visual difference between the two otherwise. Legacy data (no `mode`
// field, always had unit+count) counts as recurring, same as everywhere
// else `mode ?? 'loop'` is treated.
const isRecurring = computed(() => isLoop.value && (props.todo.loopInterval?.mode ?? 'loop') === 'loop')

// Overview's tag-row (mode 'all') stages every tag/date pick locally instead
// of writing straight to the store — picking Date used to tag the todo the
// instant the checkbox was clicked, and since the Date filter defaults to
// "hide", that yanked the card out of the (now re-filtered) list before the
// user ever got to actually pick a date in the picker that was supposed to
// appear. Now nothing reaches the store until the tag menu actually closes
// (see the showTagMenu watch below), except when it closes via Escape,
// which discards the draft instead — see onCardKeydown.
const draftTags = ref<string[]>([...props.todo.tags])
const draftLoopInterval = ref<LoopInterval | undefined>(props.todo.loopInterval)
const draftIsLoop = computed(() => draftTags.value.includes(LOOP_TAG_ID))
const draftIsPriority = computed(() => draftTags.value.includes(PRIORITY_TAG_ID))

// Card coloring previews the staged pick live — while the tag menu is open,
// checking Priority/Date fills the card in ahead of the actual commit, so
// it's not just an inert checkbox list. Once the menu is closed there's no
// draft to preview, so this just falls back to the committed state.
const previewIsPriority = computed(() => showTagMenu.value ? draftIsPriority.value : isPriority.value)
const previewIsLoop = computed(() => showTagMenu.value ? draftIsLoop.value : isLoop.value)

// Date checked for the first time: default to a one-time due date today
// (Once mode) instead of leaving the picker in its ambiguous "nothing
// selected" state.
watch(draftIsLoop, (loop) => {
  if (loop && !draftLoopInterval.value) {
    draftLoopInterval.value = { mode: 'once', startDate: todayStr() }
  }
})

function updateDraftLoopInterval(interval: LoopInterval) {
  draftLoopInterval.value = interval
}

function updateDraftTags(tags: string[]) {
  draftTags.value = tags
}

// Writes the staged tag-row edits to the store — called once the tag menu
// actually confirms-closes (see the showTagMenu watch below), never while
// it's still open. Skips the write entirely if nothing actually changed
// (just opened and closed again, e.g. ↑↓-cycling past a card without
// touching anything) — writing the same tags back still mutates the array
// reference, which in Current re-triggers filteredTodos' sort and, with it,
// useListFlip's position-shift animation on every other card for no reason
// (a real edit's shift is expected to animate; a no-op reopen's isn't).
// Returns whether the loopInterval itself actually changed — the caller
// uses that to decide whether overriding processedToday is warranted (see
// the showTagMenu watch below): just ↑↓-cycling past an untouched loop
// card shouldn't re-send it to Current every time.
function commitDraftTags(): boolean {
  const tags = draftTags.value
  const loopInterval = tags.includes(LOOP_TAG_ID) ? draftLoopInterval.value : undefined
  const tagsUnchanged = tags.length === props.todo.tags.length && tags.every(id => props.todo.tags.includes(id))
  const loopUnchanged = JSON.stringify(loopInterval) === JSON.stringify(props.todo.loopInterval)
  if (tagsUnchanged && loopUnchanged) return false
  store.updateTodo(props.todo.id, { tags, loopInterval })
  return !loopUnchanged
}

// Tags off: the per-card tag menu still offers the priority + loop tags
// (system markers, not user tags) but hides user-created tags, matching
// the same rule the add-todo tag row follows in App.vue.
const tagMenuTags = computed(() => themeStore.tagsEnabled ? store.tags : store.tags.filter(t => t.id === PRIORITY_TAG_ID || t.id === LOOP_TAG_ID))

// Priority + date kept visually apart from user tags (see .tag-row-pinned
// in layout.css) — split here so the template can render them as their
// own row instead of one mixed v-for, same split as App.vue's add-todo
// tag row.
const tagMenuPinnedTags = computed(() => tagMenuTags.value.filter(t => t.id === PRIORITY_TAG_ID || t.id === LOOP_TAG_ID))
const tagMenuRestTags = computed(() => tagMenuTags.value.filter(t => t.id !== PRIORITY_TAG_ID && t.id !== LOOP_TAG_ID))

// Same "select what you just created" rule as App.vue's add-todo tag row.
function onCardTagCreated(tag: Tag) {
  if (!draftTags.value.includes(tag.id)) updateDraftTags([...draftTags.value, tag.id])
}


const emit = defineEmits<{
  'send-to-current': [id: string]
  'remove-from-current': [id: string]
  'send-to-focus-date': [id: string]
  'unassign-focus-date': [id: string]
  'move-to-next-day': [id: string]
  'complete': [id: string]
  'done-for-now': [id: string]
  'delete': [id: string]
}>()

const showMenu = computed(() => openCheckMenuId.value === props.todo.id)
const showTagMenu = computed(() => openTagMenuId.value === props.todo.id)
// In 'current' mode "open" covers both the check-menu (showMenu) and the
// full tag/date editor (showTagMenu, e.g. after openEditFromCurrent) —
// checking showMenu alone made a title click during an active full edit
// (focus moved to a sub, then back to the title) register as "closed" and
// fall into toggleCheckMenu(), which treats that as "done editing" and
// collapses the whole card instead of re-entering the title edit.
const isCardOpen = computed(() => props.mode === 'current' ? (showMenu.value || showTagMenu.value) : showTagMenu.value)

// showTagMenu covers both Overview's tag/date editor and Current's own
// title-edit, which reuses openTagMenuId too (see openEditFromCurrent) —
// either of those, or Current's Done/Done-for-now menu, means some editor
// surface of the card is genuinely open right now.
const cardActuallyOpen = computed(() => showTagMenu.value || (props.mode === 'current' && showMenu.value))

// Subs are collapsed by default — shown once the card is genuinely open
// (see above), or forced via Current's "expand all" toggle ('half', 'off'
// behaves like the toggle not being set at all).
const forceExpandActive = computed(() => !!props.forceExpandSubs && props.forceExpandSubs !== 'off')
const subsVisible = computed(() =>
  themeStore.subsEnabled && (cardActuallyOpen.value || forceExpandActive.value)
)

// The add-sub row only makes sense while the card is genuinely open —
// forceExpandSubs alone (Current's "expand all", card still closed) shows
// existing subs to skim, but offering an input to type into a card that
// was never actually opened would be a stray, unreachable-by-click field.
const subsAddVisible = computed(() => themeStore.subsEnabled && cardActuallyOpen.value)

// Half-mode: a sub just checked off stays visible for a moment instead of
// vanishing the instant it's checked (see scheduleHalfHide below) — its id
// sits here for that whole window (sink wait + settle + fade), so
// visibleSubs keeps rendering it even though it's technically completedAt
// already. halfHiddenLeavingIds is the final sub-window of that: the fade
// itself (see .sub-item--leaving below).
const halfHiddenPendingIds = reactive(new Set<string>())
const halfHiddenLeavingIds = reactive(new Set<string>())

// Per-card override for the "N done" hint below (see toggleDoneSubsReveal) —
// shows this one card's already-done subs without opening the card itself,
// and independently of every other card's own reveal state. Reset whenever
// this display context is left entirely (see the watch below).
const doneSubsRevealed = ref(false)

// Which subs actually render: hides already-checked subs by default so the
// list reads as "what's left" — an explicitly opened card is no exception
// any more, it starts collapsed exactly like the closed-card half-mode
// preview (except one mid-vanish, see halfHiddenPendingIds above, or this
// one card's own doneSubsRevealed override, which the watch below resets
// to false every time the card opens, so it's always the default on entry).
const visibleSubs = computed(() =>
  !doneSubsRevealed.value
    ? props.todo.subs.filter(s => !s.completedAt || halfHiddenPendingIds.has(s.id))
    : props.todo.subs
)

// A force-expanded-but-still-closed card (the toggle showing its subs to
// skim, not an actual open/edit) widens to the row's full width the same
// way .tag-editing already does for an actually-open card (see
// .todo-card-wrap.subs-expanded below, same technique) — otherwise a card
// with several subs sits at its narrow title-only width while its sub-list
// wraps inside that, leaving a large empty gap beside it in the row. An
// actually-open card already gets that same width via .tag-editing, so
// this only needs to cover the closed case. Opt-out via Settings
// (themeStore.subsFullWidth): the card then stays shrink-to-fit like any
// other, sized by its widest line — title or sub.
const subsExpandedWide = computed(() =>
  themeStore.subsFullWidth && !cardActuallyOpen.value && subsVisible.value && visibleSubs.value.length > 0
)

// Half-mode's "N done" hint (see the sub-item--hint row below) — count of
// this card's own completed subs, shown whenever there's anything to report,
// open or closed alike (whether currently hidden or, via doneSubsRevealed,
// already unfolded — the row and its count stay put either way, only the
// chevron/visibleSubs change, so the same click that reveals them can also
// hide them again). A sub still mid-vanish (halfHiddenPendingIds) isn't done
// skimming its own exit animation yet, so it doesn't count here either.
const completedSubsHintCount = computed(() =>
  props.todo.subs.filter(s => s.completedAt && !halfHiddenPendingIds.has(s.id)).length
)

// The hint row's own click target — flips this one card's doneSubsRevealed
// between showing/hiding its already-done subs. Doesn't touch
// cardActuallyOpen at all (no full tag/check-menu edit involved), so it's a
// plain, cheap, reversible toggle — the same button (chevron flips
// direction) undoes it again.
function toggleDoneSubsReveal() {
  doneSubsRevealed.value = !doneSubsRevealed.value
}

// Leaving this display context entirely (card *opens* — not just staying
// open, see openedNow below — or, while closed, the toggle moves off
// 'half') drops any in-flight vanish immediately — there's nothing left to
// animate once the filtering that motivated it no longer applies, and a
// stale fade-out could otherwise resurface (as an already-invisible row)
// the next time half mode is re-entered for this card. Also resets this
// card's own doneSubsRevealed, so opening a card for a full edit (or
// whose forced expand turned off while closed) starts collapsed again next
// time — but only on the open transition itself: some unrelated prop change
// firing this watch again while the card stays open must not silently
// re-collapse subs the user just revealed mid-edit.
watch(() => [cardActuallyOpen.value, props.forceExpandSubs] as const, ([open, mode], prev) => {
  const openedNow = open && !(prev?.[0] ?? false)
  if (openedNow || (!open && mode !== 'half')) {
    doneSubsRevealed.value = false
    pendingHalfHideTimers.forEach(t => clearTimeout(t))
    pendingHalfHideTimers.clear()
    halfHiddenPendingIds.clear()
    halfHiddenLeavingIds.clear()
  }
})

// Only unchecked subs are manually reorderable (see onSubGripPointerDown/
// subRowStyle) — a checked one's position is owned entirely by the
// sink/restore mechanics above instead, and dragging is pointless with
// fewer than two unchecked subs to reorder against anyway.
const uncheckedSubsCount = computed(() => props.todo.subs.filter(s => !s.completedAt).length)

// Editing an existing sub's title (typo fix, etc.) — separate from
// newSubTitle/newSubInputRef below, which is only ever the trailing
// add-row. At most one sub is ever being edited at a time.
const editingSubId = ref<string | null>(null)
const editSubTitle = ref('')
const editSubInputRef = ref<HTMLTextAreaElement | null>(null)

function autoGrowEditSub() {
  const el = editSubInputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

// Interacting with a sub (typing a new one, or editing an existing one)
// while Current's check-menu is open promotes the card into its full edit
// mode, the same swap clicking the title or hitting F/Space already does
// (see openEditFromCurrent) — but without also jumping focus into the
// todo's own title, since it should stay right where the user already put
// it (the sub input). Check-menu mode reads as "confirm Done/Done-for-
// today", which doesn't fit while actually editing a sub. No-op in
// Overview (mode 'all' has no check-menu to begin with) and once already
// in edit mode.
function promoteFromSubInteraction() {
  if (props.mode === 'current' && showMenu.value && !showTagMenu.value) {
    openCheckMenuId.value = null
    openTagMenuId.value = props.todo.id
  }
}

function startEditSub(sub: Sub, caretPos?: number | null) {
  promoteFromSubInteraction()
  editingSubId.value = sub.id
  editSubTitle.value = sub.title
  nextTick(() => {
    const el = editSubInputRef.value
    el?.focus()
    if (el && caretPos != null) {
      const pos = Math.min(caretPos, el.value.length)
      el.setSelectionRange(pos, pos)
    }
    autoGrowEditSub()
  })
}

// Clicking a sub's text jumps straight into editing at the clicked
// position, same as handleTitleClick above.
function handleSubTitleClick(sub: Sub, e: MouseEvent) {
  startEditSub(sub, caretOffsetFromEvent(e))
}

// Turns a sub into its own todo — not directly, but by prefilling the
// add-todo input (App.vue, see requestTodoDraft) so the title can still be
// reworded and the whole thing cancelled with Escape. A parent titled
// "Project: Task" lends its "Project: " prefix (caret at the end, title
// is usually done); without one, just the sub's text with the caret at
// the start, where a prefix typically gets added. Carries over the
// parent's tags incl. priority, but not Date/loop — the parent's schedule
// rarely fits a single sub. The sub itself stays as it is, no link.
function promoteSubToTodo(sub: Sub) {
  if (editingSubId.value === sub.id) saveEditSub()
  const colon = props.todo.title.indexOf(':')
  const prefix = colon > 0 ? props.todo.title.slice(0, colon).trim() : ''
  requestTodoDraft({
    title: prefix ? `${prefix}: ${sub.title}` : sub.title,
    tags: props.todo.tags.filter(id => id !== LOOP_TAG_ID),
    caret: prefix ? 'end' : 'start',
  })
  closeActiveCard()
}

function saveEditSub() {
  const id = editingSubId.value
  if (!id) return
  editingSubId.value = null
  const trimmed = editSubTitle.value.trim()
  if (trimmed) store.updateSub(props.todo.id, id, trimmed)
}

function cancelEditSub() {
  editingSubId.value = null
}

// Same reasoning as onSubInputKeydown below: onCardKeydown bails out for
// anything inside .sub-row, so Enter/Escape need handling right here.
function onEditSubKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
    saveEditSub()
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    cancelEditSub()
    return
  }
}

// ── Sub reorder (drag handle) ──────────────────────────
// Manual pointer drag rather than motion-v's own drag — motion-v has no
// Reorder.Group/Item equivalent (framer-motion does), and the card itself
// already owns a horizontal `drag="x"` on the outer motion.div for swipe
// gestures, so this needs to be independent of that anyway. Pointer events
// on the grip are stopped before they reach it (see onSubGripPointerDown),
// same pattern as every other in-card button's @click.stop.
const dragSubId = ref<string | null>(null)
const dragSubTranslateY = ref(0)
const dragSubStartIndex = ref(-1)
const dragSubCurrentIndex = ref(-1)
let dragSubStartClientY = 0
let dragSubStepY = 0
const subRowEls = new Map<string, HTMLElement>()

function registerSubRowEl(id: string, el: Element | null) {
  if (el) subRowEls.set(id, el as HTMLElement)
  else subRowEls.delete(id)
}

// Animates a sub's own jump to a new spot in its list — used for the sink
// on completion (store.toggleSub → sinkSub, see stores/todos.ts), and gets
// any other future sub
// reorder (deletes/drag settling) the same smooth move for free rather
// than a hard snap. One `.sub-row` container per card instance, so this
// needs a direct element getter rather than useListFlip's page-level
// selector variant (see useListFlip.ts).
//
// Frozen to its last snapshot for the entire duration of a manual grip
// drag (dragSubId set) — a drag already drives every row's transform
// itself (subRowStyle below), and letting FLIP's own Web Animations API
// layer additionally animate the same elements mid-drag fought with that,
// making an upward drag feel like it hit an invisible wall partway and
// shoving other rows out of place. The snapshot only advances again once
// dragging ends, so the drop still gets a normal settle animation.
let subFlipIdsSnapshot: string[] = []
function subFlipIds(): string[] {
  if (dragSubId.value) return subFlipIdsSnapshot
  subFlipIdsSnapshot = props.todo.subs.map(s => s.id)
  return subFlipIdsSnapshot
}
const subRowContainerRef = ref<HTMLElement | null>(null)
useListFlip(subFlipIds, () => subRowContainerRef.value)

// How far the dragged row would have to travel to sit at each other slot
// — built once at drag start from every row's *actual* measured height
// (not just the dragged row's own), since sub titles can wrap onto a
// second line and rows are not all the same height. offsets[i] is the
// deltaY that lands the dragged row exactly at slot i: the summed height
// (+gap) of every row strictly between the start slot and i, signed for
// direction. Using a single uniform step (the dragged row's own height)
// here used to under/overshoot the real pixel distance whenever a row
// along the way was a different height — the drag would visually hit a
// wall short of the top, or sail straight past it, depending on which
// rows happened to be taller/shorter than the one being dragged.
let dragSubOffsets: number[] = []

// A checked sub can't be manually repositioned at all (its position is
// owned by the sink/restore mechanics in the store, see sinkSub/
// restoreSunkSub in stores/todos.ts), and an
// unchecked one being dragged can only reorder among *other* unchecked
// subs — it should never land inside or below the checked group. Both
// rules fall out of restricting the whole drag (offsets, start/current
// "index", the sibling shift in subRowStyle) to this ids-in-order
// snapshot of just the unchecked subs, taken once at grip time, instead
// of operating over the full todo.subs array including checked rows.
let dragSubDraggableIds: string[] = []

function onSubGripPointerDown(sub: Sub, e: PointerEvent) {
  e.stopPropagation()
  e.preventDefault()
  if (sub.completedAt) return
  const el = subRowEls.get(sub.id)
  const draggableIds = props.todo.subs.filter(s => !s.completedAt).map(s => s.id)
  const index = draggableIds.indexOf(sub.id)
  if (!el || index === -1) return
  const gap = parseFloat(getComputedStyle(el.parentElement as HTMLElement).rowGap || '0') || 0
  // Still just the dragged row's own height — this one drives how far a
  // row it passes over slides aside to open its slot (always the dragged
  // row's own size, regardless of that sibling's own height), which stays
  // correct even with variable row heights (see subRowStyle).
  dragSubStepY = el.getBoundingClientRect().height + gap
  const heights = draggableIds.map(id => (subRowEls.get(id)?.getBoundingClientRect().height ?? dragSubStepY) + gap)
  const offsets = new Array(heights.length).fill(0)
  let acc = 0
  for (let i = index - 1; i >= 0; i--) {
    acc += heights[i]
    offsets[i] = -acc
  }
  acc = 0
  for (let i = index + 1; i < heights.length; i++) {
    acc += heights[i]
    offsets[i] = acc
  }
  dragSubOffsets = offsets
  dragSubDraggableIds = draggableIds
  dragSubId.value = sub.id
  dragSubStartClientY = e.clientY
  dragSubTranslateY.value = 0
  dragSubStartIndex.value = index
  dragSubCurrentIndex.value = index
  lockScroll()
  window.addEventListener('pointermove', onSubGripPointerMove)
  window.addEventListener('pointerup', onSubGripPointerUp)
  window.addEventListener('pointercancel', onSubGripPointerUp)
}

function onSubGripPointerMove(e: PointerEvent) {
  if (!dragSubId.value || !dragSubOffsets.length) return
  // Clamp to the first/last *unchecked* sub's slot — otherwise the
  // dragged row keeps following the pointer past that group's own edges
  // (including on into the checked group) instead of stopping there.
  const minY = dragSubOffsets[0]
  const maxY = dragSubOffsets[dragSubOffsets.length - 1]
  const deltaY = Math.max(minY, Math.min(e.clientY - dragSubStartClientY, maxY))
  dragSubTranslateY.value = deltaY
  // Nearest offset, not a fixed-step division — offsets are cumulative
  // *real* distances now, so this is the slot whose position the dragged
  // row has actually reached, however uneven the row heights along the way.
  let nearestIndex = dragSubStartIndex.value
  let nearestDistance = Infinity
  dragSubOffsets.forEach((offset, i) => {
    const distance = Math.abs(offset - deltaY)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = i
    }
  })
  dragSubCurrentIndex.value = nearestIndex
}

// Translates a slot within dragSubDraggableIds (the unchecked-only
// subset) to the matching absolute index for store.reorderSub. reorderSub
// removes the dragged sub first and then re-inserts it, so the index it
// wants is a position in that *post-removal* array — building `subs` by
// filtering the dragged one out up front (rather than skipping it inline
// while still counting positions in the original, longer array) keeps
// every index this function returns in that same post-removal space,
// checked subs included as real, still-occupied slots along the way. The
// earlier version returned pre-removal indices instead, which landed the
// dragged sub one slot too far into the checked group — e.g. swapped with
// the first checked sub while aiming for "right after the last unchecked
// one" (the array here is one shorter, so its index is one lower).
function absoluteIndexForDraggableSlot(subId: string, slot: number): number {
  const subs = props.todo.subs.filter(s => s.id !== subId)
  let uncheckedSeen = 0
  let lastUncheckedIndex = -1
  for (let i = 0; i < subs.length; i++) {
    if (subs[i].completedAt) continue
    if (uncheckedSeen === slot) return i
    lastUncheckedIndex = i
    uncheckedSeen++
  }
  // slot was past the last unchecked sub — land right after it, not at
  // the very end of the array (which could be past the checked group).
  return lastUncheckedIndex + 1
}

function onSubGripPointerUp() {
  window.removeEventListener('pointermove', onSubGripPointerMove)
  window.removeEventListener('pointerup', onSubGripPointerUp)
  window.removeEventListener('pointercancel', onSubGripPointerUp)
  unlockScroll()
  if (dragSubId.value && dragSubCurrentIndex.value !== dragSubStartIndex.value) {
    const toIndex = absoluteIndexForDraggableSlot(dragSubId.value, dragSubCurrentIndex.value)
    store.reorderSub(props.todo.id, dragSubId.value, toIndex)
  }
  dragSubId.value = null
  dragSubTranslateY.value = 0
  dragSubStepY = 0
  dragSubOffsets = []
  dragSubDraggableIds = []
  dragSubStartIndex.value = -1
  dragSubCurrentIndex.value = -1
}

// The dragged row follows the pointer 1:1 (no transition, or it'd lag);
// every *unchecked* row it has passed over slides aside by exactly one
// step to open up the drop slot, same visual language as most
// drag-reorder lists. Ranked against dragSubDraggableIds (the unchecked
// subset), not the row's position in the full todo.subs array — a
// checked row is never part of that subset and so never shifts, matching
// it also never being reachable as a drop target (see
// absoluteIndexForDraggableSlot above).
function subRowStyle(sub: Sub) {
  if (dragSubId.value === sub.id) {
    return {
      transform: `translateY(${dragSubTranslateY.value}px)`,
      transition: 'none',
      position: 'relative' as const,
      zIndex: 2,
    }
  }
  if (!dragSubId.value || dragSubCurrentIndex.value === dragSubStartIndex.value) return {}
  const rank = dragSubDraggableIds.indexOf(sub.id)
  if (rank === -1) return {}
  const min = Math.min(dragSubStartIndex.value, dragSubCurrentIndex.value)
  const max = Math.max(dragSubStartIndex.value, dragSubCurrentIndex.value)
  if (rank < min || rank > max) return {}
  const dir = dragSubCurrentIndex.value > dragSubStartIndex.value ? -1 : 1
  return { transform: `translateY(${dir * dragSubStepY}px)` }
}

const newSubTitle = ref('')
const newSubInputRef = ref<HTMLTextAreaElement | null>(null)

function autoGrowSub() {
  const el = newSubInputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

// Enter adds the sub and keeps the same input focused+cleared, rather than
// mounting a genuinely new row — reads as "the next line opens" without
// needing its own draft-row bookkeeping.
function submitNewSub() {
  const trimmed = newSubTitle.value.trim()
  if (!trimmed) return
  store.addSub(props.todo.id, trimmed)
  newSubTitle.value = ''
  nextTick(() => {
    autoGrowSub()
    newSubInputRef.value?.focus()
  })
}

// Mirrors clearTodoInput in App.vue for this input's own clear button (see
// .sub-input-clear below).
function clearNewSubInput() {
  newSubTitle.value = ''
  nextTick(() => {
    autoGrowSub()
    newSubInputRef.value?.focus()
  })
}

// Tab out of the title (while editing) jumps straight into the add-sub
// input — only while subs are actually visible/enabled. With subs off,
// Tab isn't intercepted anywhere here and just does whatever the browser's
// own default focus-move does (App.vue's document-level handler ignores
// Tab entirely while a text field is focused, see isTypingTarget there);
// card-cycling itself moved to ↑↓ and no longer happens while editing (see
// cycleOpenCard's own comment) either way.
function onTitleTabKeydown(e: KeyboardEvent) {
  if (e.key !== 'Tab' || e.shiftKey) return
  if (!subsVisible.value) return
  e.preventDefault()
  e.stopPropagation()
  nextTick(() => newSubInputRef.value?.focus())
}

// Everything the add-sub input needs to handle itself, since
// onCardKeydown (the document-level listener) bails out entirely for
// anything inside .sub-row (see its own comment) — so Enter/Tab/Escape
// have to be handled right here instead of falling through to it.
function onSubInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    // Enter on an empty draft isn't "add an empty sub" (submitNewSub already
    // no-ops on that) — it reads as "never mind", so it should back out of
    // the input entirely instead of just sitting there, landing back on the
    // still-open card one level up rather than closing it outright.
    if (!newSubTitle.value.trim()) {
      newSubInputRef.value?.blur()
      return
    }
    submitNewSub()
    return
  }
  // Only one sub input exists at a time (existing subs are static rows,
  // not fields of their own) — so both directions of the cycle collapse
  // to the same single hop: out of the sub input, back into the title.
  // Re-enters edit mode if it isn't already (e.g. subs were opened via
  // Current's Done-menu or the "expand all" toggle, never through editing).
  if (e.key === 'Tab') {
    e.preventDefault()
    // App.vue's own Tab handler already ignores this (it's a typing
    // target), but stopping it here too keeps this self-contained rather
    // than relying on that guard.
    e.stopPropagation()
    if (!isEditing.value) startEdit()
    nextTick(() => editInputRef.value?.focus())
    return
  }
  // Escape has to fully replicate onCardKeydown's own Escape branch here
  // (that listener never sees this keystroke at all, see above) rather
  // than just blurring the input, so Escape keeps working exactly like it
  // does everywhere else on the card.
  if (e.key === 'Escape') {
    e.preventDefault()
    if (showMenu.value) {
      openCheckMenuId.value = null
    } else if (showTagMenu.value) {
      discardDraftTagsOnClose = true
      openTagMenuId.value = null
    }
    return
  }
}

// The actual sink (checking a sub → it moves to the bottom after a delay)
// and its rank-based restore on unchecking both live in the store now, not
// here — see Sub.sunkRank's own comment in stores/todos.ts for why: a
// TodoCard instance doesn't outlive a view switch, but the data (and the
// pending timer driving it) needs to.

// Half-mode only (see visibleSubs/halfHiddenPendingIds above): a checked sub
// isn't yanked out of the list instantly, it goes through the same three
// beats as the rest of this section reads out loud — wait (matching
// store.SUB_SINK_DELAY_MS, the same pause the store's own sink gives you to
// undo an accidental tap), sink (the store's reorder-to-bottom, already
// running in parallel, slides it down past the still-open subs), then fade
// — only once it's actually settled at the bottom, not overlapping the
// slide. Purely visual/local to this mounted card, unlike the sink itself —
// if the card unmounts mid-sequence there's nothing to resume, the sub is
// just plainly hidden (or shown) next time based on its real completedAt.
const HALF_HIDE_SETTLE_MS = 350
const HALF_HIDE_LEAVE_MS = 260
const pendingHalfHideTimers = new Map<string, ReturnType<typeof setTimeout>>()

function cancelHalfHide(subId: string) {
  halfHiddenPendingIds.delete(subId)
  halfHiddenLeavingIds.delete(subId)
  const timer = pendingHalfHideTimers.get(subId)
  if (timer) {
    clearTimeout(timer)
    pendingHalfHideTimers.delete(subId)
  }
}

function scheduleHalfHide(subId: string) {
  cancelHalfHide(subId)
  halfHiddenPendingIds.add(subId)
  pendingHalfHideTimers.set(subId, setTimeout(() => {
    pendingHalfHideTimers.set(subId, setTimeout(() => {
      halfHiddenLeavingIds.add(subId)
      pendingHalfHideTimers.set(subId, setTimeout(() => {
        pendingHalfHideTimers.delete(subId)
        halfHiddenLeavingIds.delete(subId)
        halfHiddenPendingIds.delete(subId)
      }, HALF_HIDE_LEAVE_MS))
    }, HALF_HIDE_SETTLE_MS))
  }, store.SUB_SINK_DELAY_MS))
}

// Toggling the last open sub complete auto-opens the Done/Done-for-now
// menu (Current only) — a nudge to actually close the todo out, without
// forcing it: the todo stays put if nothing's clicked. Only fires on the
// transition into "all done", not on every click once already all done.
function handleToggleSub(sub: Sub, event: MouseEvent) {
  const wasChecked = !!sub.completedAt
  const wasAllDone = props.todo.subs.length > 0 && props.todo.subs.every(s => s.completedAt)
  store.toggleSub(props.todo.id, sub.id)
  if (!wasChecked && themeStore.celebrationsEnabled) {
    burstCheckbox(event.currentTarget as HTMLElement)
  }
  if (wasChecked) {
    cancelHalfHide(sub.id)
  } else if (!doneSubsRevealed.value) {
    scheduleHalfHide(sub.id)
  }
  const nowAllDone = props.todo.subs.length > 0 && props.todo.subs.every(s => s.completedAt)
  if (!wasAllDone && nowAllDone && props.mode === 'current' && !showMenu.value) {
    openCheckMenuId.value = props.todo.id
  }
}

function handleDeleteSub(subId: string) {
  cancelHalfHide(subId)
  store.deleteSub(props.todo.id, subId)
}

// Current's check-row (Done for now / Done): defaults to "Done for now"
// each time it opens fresh — Left/Right toggle it, Enter confirms whichever
// is focused (see onCardKeydown below), so the pair is fully keyboard-
// operable without a mouse.
const focusedCheckOption = ref<'now' | 'done'>('now')
watch(showMenu, (open) => {
  if (open) focusedCheckOption.value = 'now'
})

// After a mouse drag (unlike touch), the browser still synthesizes a plain
// `click` on mouseup regardless of how far the pointer moved in between —
// so releasing a swipe back into Hold on desktop was re-toggling the card
// open/closed as an unwanted side effect. Set in onDragStart (not
// onDragEnd — that risks running after the browser's own click, which
// fires synchronously right on mouseup) and checked at the very top of
// every click-driven toggle below, so it catches the click regardless of
// which element it actually lands on.
let justDragged = false

function toggleCheckMenu() {
  if (justDragged) { justDragged = false; return }
  // This card's own tag/date editor (openEditFromCurrent) is already open —
  // a plain click on the card body here means "I'm done with this edit",
  // same as toggleTagMenu's re-click-to-close in Overview. Without this,
  // it fell through to the willOpen branch below and swapped straight into
  // the check-menu instead, so the very next Enter (meant to just finish
  // the edit) landed on the check-menu's own Enter handling and marked the
  // todo done/done-for-now instead of simply closing the card.
  if (showTagMenu.value) {
    if (isEditing.value) saveEdit()
    openTagMenuId.value = null
    return
  }
  const willOpen = openCheckMenuId.value !== props.todo.id
  // Opening a check-menu (this card's own, or by clicking a different
  // Current card entirely) would otherwise leave whichever card's tag/date
  // editor is currently open (see openEditFromCurrent) open alongside it —
  // close it first, same as opening a tag-menu already unconditionally
  // closes any open check-menu below.
  if (willOpen && openTagMenuId.value) openTagMenuId.value = null
  openCheckMenuId.value = willOpen ? props.todo.id : null
  if (willOpen) nextTick(scrollCardIntoView)
}

const wrapRef = ref<HTMLElement | null>(null)

// Clicks inside an element marked data-keeps-card-open (the tour's coach
// card, see tutorial/) don't count as "outside".
function closeOnOutside(e: MouseEvent) {
  if ((e.target as Element | null)?.closest?.('[data-keeps-card-open]')) return
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    if (openCheckMenuId.value === props.todo.id) openCheckMenuId.value = null
    if (openTagMenuId.value === props.todo.id) openTagMenuId.value = null
  }
}

// Closing is where the staged tag edits (see draftTags above) actually
// land — every way of closing the tag menu commits them (click elsewhere,
// ↑↓ to the next card, Enter, a view switch) except Escape, which sets
// discardDraftTagsOnClose first so the draft is thrown away instead.
// Sending a freshly due loop todo to Current is
// deferred to right after that same commit, for the same reason the commit
// itself is deferred — doing it the instant Loop got checked used to yank
// the card out of the list before the user could even see the picker.
//
// runLoopSchedule alone isn't enough here: it skips any todo already
// "processed today" (see its own processedToday check) — correct for the
// automatic once-a-day check it's built for (don't undo an earlier "Done
// for today"), but wrong for a genuine schedule edit. Explicitly changing
// the schedule so it's due right now is a deliberate action, not the daily
// sweep, and should win even if this same todo happened to touch Current
// earlier today (sent, then removed; done for now; whatever left a stale
// focusAddedAt behind) — otherwise the todo silently stays parked in the
// pool with no sign anything's wrong, since the picker itself has no way
// to know about that history. Gated on commitDraftTags() actually having
// changed the loopInterval, though — just ↑↓-cycling past an open loop
// card without touching anything still closes the menu on every card it
// passes through, and that alone shouldn't repeatedly override
// processedToday and re-send an already-handled-today todo. Also skipped
// if it's already in Current (mode 'current' edits, via openEditFromCurrent) —
// nothing to send.
let discardDraftTagsOnClose = false
watch(showTagMenu, (isOpen, wasOpen) => {
  if (isOpen) {
    draftTags.value = [...props.todo.tags]
    draftLoopInterval.value = props.todo.loopInterval
  }
  if (wasOpen && !isOpen) {
    // A still-focused input inside the card (e.g. LoopPicker's custom
    // every-X-days field) only commits its typed value on blur — that's
    // when the native 'change' event fires, which is what actually calls
    // LoopPicker's applyCustomCount() and emits the update up to
    // draftLoopInterval. Closing via Enter/Escape/Tab never blurs it (only
    // a click outside the card does, as an incidental side effect of the
    // click itself), so without this, commitDraftTags() below read the
    // stale pre-edit value — the freshly typed number only "stuck" the
    // *next* time the menu was closed after some other blur had already
    // flushed it. Forcing the blur here, right before reading the draft,
    // makes every close path commit the value that's actually on screen.
    const active = document.activeElement as HTMLElement | null
    if (active && wrapRef.value?.contains(active)) active.blur()
    if (discardDraftTagsOnClose) {
      discardDraftTagsOnClose = false
    } else {
      const loopChanged = commitDraftTags()
      if (isLoop.value) {
        runLoopSchedule(store)
        const interval = props.todo.loopInterval
        if (loopChanged && interval && !props.todo.inCurrent && isLoopDueToday(interval, appDate(), localDayOf(props.todo.createdAt))) {
          emit('send-to-current', props.todo.id)
        }
      }
    }
  }
})

// This listener only exists once the card is already open (see the watch
// above), so showTagMenu/showMenu are always true for whichever mode
// applies here — App.vue's global Enter (see its onGlobalKeydown) is what
// opened it in the first place, and shortcutsBlocked() there defers to
// this listener for everything from here on.
//
// Escape closes the card when it's open but not being edited, and so
// does Enter for the tag-menu (Overview) case — Enter reads as "I'm done
// here" (e.g. after just picking tags), not "send to Current", so that's
// F instead (below), and Space starts editing. For the check-menu
// (Current) case Enter still confirms whichever option is focused. The
// textarea has its own Escape/Enter handlers for the editing case itself (cancelEdit/
// acceptEdit), and ignoring them here (isEditing guard up top) keeps the
// two from double-handling the same key. Left/Right toggle check-menu
// focus between the two options — the pair sits side by side (see
// .check-row's grid), so left/right reads naturally rather than up/down.
// that's also part of why card-to-card cycling itself uses ↑↓, not ←→ —
// the two would otherwise collide inside Current's open check-menu. ↑↓
// aren't handled here — App.vue's single document-level handler drives
// card-to-card cycling via cycleOpenCard() instead, using the
// activeCardApi registered below.
function onCardKeydown(e: KeyboardEvent) {
  // The sub-list (checkboxes, delete buttons, the add-sub textarea) is a
  // second typing/interaction surface this document-level listener didn't
  // know about — without this, typing a sub title containing "d" or a
  // space bubbled straight up and triggered Delete/startEdit below, and
  // Enter/Escape fought with the sub input's own handling (see
  // onSubInputKeydown). Bail out entirely for anything inside it, same
  // idea as the isEditing guard right below for the title textarea.
  if ((e.target as HTMLElement)?.closest?.('.sub-row')) return
  if (isEditing.value) return
  // The tour (see tutorial/) runs without card shortcuts — a stray D or C
  // would delete or move the very todo it's built around. Only Enter and
  // Escape (close the card) stay.
  if (sandboxActive.value && e.key !== 'Enter' && e.key !== 'Escape') return
  if (showMenu.value && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault()
    focusedCheckOption.value = focusedCheckOption.value === 'now' ? 'done' : 'now'
    return
  }
  // Space starts editing, in either mode (cardActuallyOpen covers both —
  // see its own comment). Overview's tag menu already has the editor UI
  // open (showTagMenu), so a plain startEdit() is enough there. Current's
  // check-menu doesn't: it needs the same swap to the tag/date editor
  // that double-clicking the title or C does (openEditFromCurrent), closing
  // the check-menu first, before it can start editing.
  if (e.key === ' ' && cardActuallyOpen.value) {
    e.preventDefault()
    if (showTagMenu.value) startEdit()
    else openEditFromCurrent()
    return
  }
  // D — delete in Overview (opens the same confirm modal the Trash icon/
  // delete zone do, not an instant delete), remove-from-Current in Current
  // (mirrors the CircleMinus button/remove zone there — no confirmation,
  // since it's just moving the todo back to Overview, not discarding it).
  if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault()
    if (showTagMenu.value) pendingDelete.value = true
    else if (showMenu.value) removeFromList()
    return
  }
  // C — Overview only, same move as its own "+" button: plans onto the
  // selected Date List with Date Lists on, sends to Current otherwise (see
  // that button's own comment above). Split off from Enter: Enter is what
  // people intuitively reach for after just picking tags to "save and
  // close", not to also move the todo as a side effect. Shares its letter
  // with App.vue's own C (Calendar toggle), same "only inside an open card"
  // split already used for D (Delete vs. Date-filter cycle) — App.vue's
  // Calendar shortcut only fires when no card is open, so the two never
  // actually compete.
  // The card itself flies off to the list (top of Overview with Date Lists,
  // out of Overview without) — focus moves on to the next card in the pool
  // instead of riding along with it (previous one if it was the last).
  if (e.key.toLowerCase() === 'c' && showTagMenu.value && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault()
    commitDraftTags()
    if (!isOnList.value) {
      const ids = props.siblingIds ?? []
      const idx = ids.indexOf(props.todo.id)
      openTagMenuId.value = idx === -1 ? null : (ids[idx + 1] ?? ids[idx - 1] ?? null)
      revealCard(openTagMenuId.value)
    }
    addToList()
    return
  }
  if (e.key !== 'Escape' && e.key !== 'Enter') return
  e.preventDefault()
  if (e.key === 'Enter' && showMenu.value && !props.previewLocked) {
    if (focusedCheckOption.value === 'now') handleDoneForNow(props.todo.id)
    else handleComplete(props.todo.id)
    return
  }
  if (showMenu.value) openCheckMenuId.value = null
  else if (showTagMenu.value) {
    // Escape discards the staged tag-row edits instead of committing them —
    // everything else that closes the menu (Enter, clicking elsewhere, Tab)
    // saves, so Escape is the one deliberate "never mind" out.
    if (e.key === 'Escape') discardDraftTagsOnClose = true
    openTagMenuId.value = null
  }
}

watch([showMenu, showTagMenu], ([m, t]) => {
  if (m || t) {
    document.addEventListener('click', closeOnOutside)
    document.addEventListener('keydown', onCardKeydown)
    activeCardApi.value = {
      todoId: props.todo.id,
      mode: props.mode,
      getSiblingIds: () => props.siblingIds,
      isEditing: () => isEditing.value,
      saveEdit,
    }
  } else {
    document.removeEventListener('click', closeOnOutside)
    document.removeEventListener('keydown', onCardKeydown)
    if (activeCardApi.value?.todoId === props.todo.id) activeCardApi.value = null
    // Only blur if focus is still inside *this* card — otherwise this fires
    // after focus has already moved on to a different card (e.g. clicking
    // straight from one open todo into another) and would steal it back.
    requestAnimationFrame(() => {
      const active = document.activeElement as HTMLElement | null
      if (active && wrapRef.value?.contains(active)) active.blur()
    })
  }
})

function toggleTagMenu() {
  if (justDragged) { justDragged = false; return }
  openCheckMenuId.value = null
  const willOpen = openTagMenuId.value !== props.todo.id
  openTagMenuId.value = willOpen ? props.todo.id : null
  if (!willOpen && isEditing.value) saveEdit()
  if (willOpen) nextTick(scrollCardIntoView)
}

// Clicking the empty space between tag chips (not a chip itself) closes the
// card, same as clicking the title bar again would.
function handleTagRowClick(e: MouseEvent) {
  if (e.target === e.currentTarget) toggleTagMenu()
}

// Animates the check-row/tag-row open/closed by height, via JS transition
// hooks rather than a CSS-only grid-rows trick — that trick needs the
// element to stay in the DOM (just collapsed) even while closed, but its
// content (particularly the full tag list, identical across every todo)
// then still counts toward each card's own shrink-to-fit width, making
// every card the same (widest) size and breaking the grid layout. Instead
// each row still fully unmounts via v-if when closed (exactly like
// before), and only exists in the DOM — with its height explicitly
// animated — while actually opening or closing.
//
// Desktop skips the animation entirely (done() called immediately, same
// as no transition at all) — on a mouse-driven, already-snappy desktop
// layout it read as janky rather than smooth; kept only for mobile/
// tablet, where opening a card reads more like unfolding a sheet.
const DESKTOP_BREAKPOINT = 1024

function onExpandEnter(el: Element, done: () => void) {
  const e = el as HTMLElement
  if (window.innerWidth > DESKTOP_BREAKPOINT) { done(); return }
  e.style.height = '0px'
  e.style.opacity = '0'
  e.style.overflow = 'hidden'
  requestAnimationFrame(() => {
    e.style.transition = 'height 0.2s ease-out, opacity 0.2s ease-out'
    e.style.height = `${e.scrollHeight}px`
    e.style.opacity = '1'
  })
  e.addEventListener('transitionend', () => {
    e.style.height = ''
    e.style.opacity = ''
    e.style.overflow = ''
    e.style.transition = ''
    done()
  }, { once: true })
}

// Closing is quicker than opening and fades out alongside the height
// collapse — a plain height-only collapse at the same speed as opening
// read as slow and let the shrinking content visibly squash instead of
// just disappearing.
function onExpandLeave(el: Element, done: () => void) {
  const e = el as HTMLElement
  if (window.innerWidth > DESKTOP_BREAKPOINT) { done(); return }
  e.style.height = `${e.scrollHeight}px`
  e.style.overflow = 'hidden'
  requestAnimationFrame(() => {
    e.style.transition = 'height 0.12s ease-in, opacity 0.1s ease-in'
    e.style.height = '0px'
    e.style.opacity = '0'
  })
  e.addEventListener('transitionend', () => done(), { once: true })
}

// Opens the card (if needed) and jumps straight into editing.
function openForEdit(caretPos?: number | null) {
  openTagMenuId.value = props.todo.id
  startEdit(caretPos)
}

// Current's double-click equivalent: opens the same tag/date editor Overview
// uses, on top of a 'current'-mode card — closes the Done/Done-for-now
// check-menu first if that's what was open. Picking a new date here still
// leaves the todo in Current throughout: commitDraftTags (see draftTags
// above) only ever writes tags/loopInterval, never inCurrent.
function openEditFromCurrent(caretPos?: number | null) {
  openCheckMenuId.value = null
  openTagMenuId.value = props.todo.id
  startEdit(caretPos)
}

// Resolves a mouse click to a character offset in the clicked text, so
// clicking into a title/sub mid-word can drop the edit caret at that exact
// spot instead of always landing at the start. caretRangeFromPoint is the
// standard (Chrome/Safari); Firefox only has caretPositionFromPoint. Neither
// is on the official TS DOM lib for the other browser's method, hence `any`.
// The offset is relative to the hit text node, so it's shifted by the text
// before that node — a title split into several nodes by LinkifiedText's
// links would otherwise land the caret relative to just one segment.
function caretOffsetFromEvent(e: MouseEvent): number | null {
  const doc = document as any
  let node: Node | null = null
  let offset = 0
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(e.clientX, e.clientY)
    if (!range) return null
    node = range.startContainer
    offset = range.startOffset
  } else if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(e.clientX, e.clientY)
    if (!pos) return null
    node = pos.offsetNode
    offset = pos.offset
  } else {
    return null
  }
  const root = e.currentTarget as Node | null
  if (!root || !node || !root.contains(node)) return offset
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let t = walker.nextNode(); t && t !== node; t = walker.nextNode()) {
    offset += t.textContent?.length ?? 0
  }
  return offset
}

// Clicking the title text jumps straight into editing at the clicked
// position, but only once the card is already open — on a closed card the
// first click just opens it, same as clicking anywhere else on the card
// (todo-card-main's own click handler), so a closed card never skips
// straight past "open" into "edit" on a single click.
function handleTitleClick(e: MouseEvent) {
  if (justDragged) { justDragged = false; return }
  if (!isCardOpen.value) {
    if (props.mode === 'current') toggleCheckMenu()
    else toggleTagMenu()
    return
  }
  const caretPos = caretOffsetFromEvent(e)
  if (props.mode === 'all') openForEdit(caretPos)
  else openEditFromCurrent(caretPos)
}

// Quick priority toggle for Current's card row — the only other way to set
// priority is opening the tag menu, which doesn't exist in 'current' mode
// (Current cards use the check-menu instead, see toggleCheckMenu). Reuses
// updateTags so unchecking loop-orphan cleanup etc. stays in one place.
function togglePriority() {
  updateTags(isPriority.value ? props.todo.tags.filter(id => id !== PRIORITY_TAG_ID) : [...props.todo.tags, PRIORITY_TAG_ID])
}

function updateTags(tags: string[]) {
  // Unchecking loop should drop its recurrence config too — otherwise it
  // sits there orphaned (tags: [], loopInterval still set) and, if loop
  // gets checked again later, reappears as whatever it was last time
  // instead of resetting to the normal Daily/today default.
  if (tags.includes(LOOP_TAG_ID)) {
    store.updateTodo(props.todo.id, { tags })
  } else {
    store.updateTodo(props.todo.id, { tags, loopInterval: undefined })
  }
}

// ── Edit title ──────────────────────────────────────────
const isEditing = ref(false)
const editTitle = ref('')
const editInputRef = ref<HTMLTextAreaElement | null>(null)

function autoGrow() {
  const el = editInputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

// On mobile, focusing the textarea pops the on-screen keyboard, which can
// cover the very card you just opened if it sits low in the list. Scroll
// it fully into view once the keyboard has finished animating in (the
// visualViewport resize is the actual signal; the timeout is just a
// fallback for browsers/situations where it doesn't fire). Aligns to the
// top edge rather than centering — if the expanded card (grown by lots of
// tags/a long title) is taller than the space above the keyboard, the top
// stays reliably visible and the overflow disappears below the input
// instead of the top getting pushed off-screen.
function scrollCardIntoView() {
  // Desktop has no on-screen keyboard covering the card, so there's
  // nothing to compensate for — only mobile/tablet need this.
  if (window.innerWidth > 1024) return
  const el = wrapRef.value
  if (!el) return
  let done = false
  const doScroll = () => {
    if (done) return
    done = true
    el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
  window.visualViewport?.addEventListener('resize', doScroll, { once: true })
  setTimeout(doScroll, 350)
}

function startEdit(caretPos?: number | null) {
  editTitle.value = props.todo.title
  isEditing.value = true
  nextTick(() => {
    const el = editInputRef.value
    el?.focus()
    if (el && caretPos != null) {
      const pos = Math.min(caretPos, el.value.length)
      el.setSelectionRange(pos, pos)
    }
    autoGrow()
    scrollCardIntoView()
  })
}

function saveEdit() {
  const trimmed = editTitle.value.trim()
  if (trimmed && trimmed !== props.todo.title) {
    store.updateTodo(props.todo.id, { title: trimmed })
  }
  isEditing.value = false
}

// Both land back on the open (tag-menu-visible) card rather than closing
// it outright — editing is one layer *inside* "open", not a replacement
// for it, so finishing (or bailing on) an edit should only pop that one
// layer. A second Escape (now hitting onCardKeydown's own Escape branch
// instead, since isEditing is false again) closes the card itself.
function acceptEdit() {
  saveEdit()
}

function cancelEdit() {
  isEditing.value = false
}

function handleComplete(id: string) {
  // showMenu was open to even reach this button, so the teaser watcher
  // (App.vue) has normally already settled and persisted a valid key.
  if (themeStore.celebrationsEnabled) celebrateBackground(props.todo.celebration)
  openCheckMenuId.value = null
  emit('complete', id)
}

function handleDoneForNow(id: string) {
  if (themeStore.celebrationsEnabled) celebrateBackground(props.todo.celebration)
  openCheckMenuId.value = null
  emit('done-for-now', id)
}

// ── Swipe ──────────────────────────────────────────────
// `drag="x"` keeps touch-action: pan-y, so Motion itself makes the
// scroll-vs-drag call the instant a touch starts, based on its initial
// direction — a mostly-vertical gesture is left alone and scrolls the list
// natively; a mostly-horizontal one is claimed as a drag. Only once Motion
// has already committed to "this is a drag" do we manually mirror the
// pointer's vertical offset onto `y` too (see onDrag/DRAG_ENGAGE_THRESHOLD),
// so the card still follows the finger freely in every direction — without
// ever having to fight the browser for scroll ownership.
const swipeContainerRef = ref<HTMLElement | null>(null)

// Tracks this card's actual rendered height so the hover puff below (see
// .swipe-container:hover) can cap its growth in real pixels instead of a
// flat percentage — a tall card (many subs expanded) would otherwise puff
// up by enough pixels per edge to eat into the fixed gap to the next card.
const cardHeight = ref(0)
let cardResizeObserver: ResizeObserver | null = null

// A title that only barely wraps (a handful of characters spilling onto a
// second line) shrinks back to one line instead — a title that's genuinely
// long stays multi-line untouched. The shrinking itself is shared with
// Current.vue's yesterday rows (shrinkFontToFit, useFitFont.ts).
const titleRef = ref<HTMLElement | null>(null)
const OVERFLOW_TOLERANCE_CHARS = 6
const MIN_SHRINK_RATIO = 0.85
const SHRINK_STEP_PX = 0.3

// `.todo-title` is a flex item (flex: 1 on the parent), which blockifies it
// even though it's written as a <span> — so getClientRects() always reports
// a single rect for the whole (possibly multi-line) box, not one per line.
// clientWidth/scrollWidth are reliable here precisely because of that
// blockification; wrapping is detected by forcing nowrap and comparing the
// resulting scrollWidth against the box's normal clientWidth.
function measureOverflowPx(el: HTMLElement): number {
  const availableWidth = el.clientWidth
  const prevWhiteSpace = el.style.whiteSpace
  el.style.whiteSpace = 'nowrap'
  const naturalWidth = el.scrollWidth
  el.style.whiteSpace = prevWhiteSpace
  return naturalWidth - availableWidth
}

function fitTitleFont() {
  const el = titleRef.value
  if (!el) return
  el.style.fontSize = ''
  const overflow = measureOverflowPx(el)
  if (overflow <= 0) return

  // Only for a title that spills a handful of characters onto a second
  // line — not one that's genuinely long enough to need two lines.
  const baseSize = parseFloat(getComputedStyle(el).fontSize)
  // Rough proportional-font heuristic (avg char ≈ half the font size) —
  // exact enough to tell "a few characters" apart from "a whole extra word".
  const tolerancePx = OVERFLOW_TOLERANCE_CHARS * baseSize * 0.5
  if (overflow > tolerancePx) return

  shrinkFontToFit(el, () => measureOverflowPx(el) <= 0, { minRatio: MIN_SHRINK_RATIO, step: SHRINK_STEP_PX })
}

onMounted(() => {
  if (!swipeContainerRef.value) return
  cardResizeObserver = new ResizeObserver(entries => {
    cardHeight.value = entries[0].contentRect.height
    fitTitleFont()
  })
  cardResizeObserver.observe(swipeContainerRef.value)
})

// Box-size changes are already covered by cardResizeObserver above — these
// cover content changes that can alter wrapping without changing the box
// itself (new text, a different assigned font, leaving edit mode remounts
// the span fresh).
watch(() => props.todo.title, () => nextTick(fitTitleFont))
watch(() => props.font, () => nextTick(fitTitleFont))
watch(isEditing, editing => { if (!editing) nextTick(fitTitleFont) })

// 3.5% is fine for a typical card's height — the min() below only ever
// binds once a card is tall enough that 3.5% would grow it by more than
// MAX_HOVER_GROWTH_PX per edge; for anything shorter it's a no-op and the
// normal 3.5% puff still applies.
const MAX_HOVER_GROWTH_PX = 6
const hoverScale = computed(() => {
  if (!cardHeight.value) return 1.035
  return Math.min(1.035, 1 + (2 * MAX_HOVER_GROWTH_PX) / cardHeight.value)
})
const x = useMotionValue(0)
const y = useMotionValue(0)
const rotate = useTransform(x, [-200, 200], [-8, 8])
// Only animated for the fly-out after a zone drop (see flyOutRight) —
// stays at 1 the rest of the time, so binding it in :style below is a
// no-op until then.
const cardOpacity = useMotionValue(1)
// Only animated by springBackToCenter's explicit settle back to 1 — see its
// own comment. Stays at 1 the rest of the time, same as cardOpacity above.
const cardScale = useMotionValue(1)
// Raw mirrors of physical position (used for the elevated z-index / lifted
// state only — that has to reflect the actual on-screen offset, not the
// relative swipe measurement below). Derived directly from position rather
// than tracked drag-start/drag-end bookkeeping, so it stays correct even if
// a gesture gets interrupted (pointercancel, direction handed to native
// scroll mid-drag, etc.) without a clean onDragEnd.
const swipeX = ref(0)
const swipeY = ref(0)

// Horizontal distance from the grip's start before the vertical follow
// kicks in — small enough to feel
// instant, but enough to stay clear of Motion's own direction-lock tolerance
// (so we never turn on a y-follow for what was actually a scroll).
const DRAG_ENGAGE_THRESHOLD = 10
// Latched per grip: once past the threshold the card keeps following
// vertically even when it swings back near its start column — otherwise
// it stalls on its own row (and the pointer drifts over other cards).
let dragEngaged = false
const SPRING_BACK = { type: 'spring', stiffness: 500, damping: 32 } as const

// Lifted above every sibling card and the sticky header/bottom-nav for as
// long as the card is visibly off-center — see the .dragging CSS comment.
const isLifted = computed(() => swipeX.value !== 0 || swipeY.value !== 0)

useMotionValueEvent(x, 'change', (latest) => {
  swipeX.value = latest
})
useMotionValueEvent(y, 'change', (latest) => {
  swipeY.value = latest
})

// Disabled while a menu/edit UI underneath is in use, so drag gestures don't
// fight with taps on checkboxes/buttons revealed by the open card.
const canDrag = computed(() => !isEditing.value && !showTagMenu.value && !showMenu.value)

// Same "today"/"tomorrow" special-casing as the Current sidebar's Date-List
// nav (see App.vue) — a raw D/M reads as just another date otherwise, even
// for the two days a swipe-planned todo is most likely to land on.
function formatShortDate(dateStr: string): string {
  if (dateStr === todayStr()) return 'today'
  if (dateStr === tomorrowStr()) return 'tomorrow'
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

// With Date Lists on, Overview's "add to current" icon/zone (mode 'all')
// is repurposed to plan onto the Focus Date widget's currently selected
// date instead — Current itself has no UI of its own once Date Lists are
// on (see CLAUDE.md's Date Lists section), so this is now the one action
// that slot performs. Whether it reads as add or remove follows this
// todo's membership on that specific date, mirroring the old
// todo.inCurrent toggle it replaced.
// Same live definition as the list itself (store.isOnFocusDate): a Date
// todo due that day counts as on it, even without a focusDates entry.
const isOnSelectedFocusDate = computed(() => store.isOnFocusDate(props.todo, themeStore.selectedFocusDate))

// The Date List this card is currently shown as a member of, if any —
// Overview: the Focus Date widget's selection (only once this todo is
// actually on it), Current: the list being viewed (App.vue's viewingDate,
// injected the same way Current.vue reads it). Drives the closed card's
// list actions (priority / move to next day / remove), which both views
// share — see the template's card-actions block.
const viewingDate = inject<Ref<string | null>>('viewingDate', ref(null))
const listDate = computed<string | null>(() => {
  if (!themeStore.dateListsEnabled) return null
  if (props.mode === 'all') return isOnSelectedFocusDate.value ? themeStore.selectedFocusDate : null
  return viewingDate.value
})
const nextListDate = computed(() => listDate.value ? addDaysStr(listDate.value, 1) : null)

// "The list" a card's add/remove icons act on — one concept, whatever it
// concretely means right now: Current always shows its own list's
// members; in Overview it's the selected Date List with Date Lists on, the
// inCurrent-based Current list otherwise. isOnList decides which icons
// the closed card shows (add vs. the list actions), addToList/
// removeFromList/toggleList do the matching move — the only place that
// branches on mode/Date Lists for it. Icons, swipe zones and the C/D keys
// all go through these.
const isOnList = computed(() => {
  if (props.mode === 'current') return true
  return themeStore.dateListsEnabled ? isOnSelectedFocusDate.value : props.todo.inCurrent
})
function addToList() {
  if (themeStore.dateListsEnabled) {
    triggerPlannedPulse()
    emit('send-to-focus-date', props.todo.id)
  } else {
    emit('send-to-current', props.todo.id)
  }
}
function removeFromList() {
  if (props.mode === 'all' && themeStore.dateListsEnabled) emit('unassign-focus-date', props.todo.id)
  else emit('remove-from-current', props.todo.id)
}
function toggleList() {
  if (isOnList.value) removeFromList()
  else addToList()
}
function moveToNextDay() {
  emit('move-to-next-day', props.todo.id)
}

// ── Swipe zones ──────────────────────────────────────────────────────
// Drop-in-a-corner-triangle model (see zoneHit/onDrag/onDragEnd) —
// absolute-position hit-testing against fixed corner triangles.
type ZoneSlot = 'focus' | 'date' | 'delete' | 'next'
type ZoneCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface SwipeZone {
  key: ZoneSlot
  label: string
  // Right-angle corner (sits in the matching corner of backdropRect, pulled
  // in by ZONE_EDGE_INSET) plus each leg's signed length — positive w/h
  // point right/down, negative left/up, i.e. always away from the corner
  // toward the screen center.
  cornerX: number
  cornerY: number
  w: number
  h: number
}

// Right triangles in the corners, slanted edge facing the screen center —
// close enough to the middle that a card never has to travel far to land
// in one, while the middle itself stays free to drag around in (and to
// abort a swipe by just letting go there). Each slot is its own corner +
// [horizontal leg, vertical leg] as fractions of backdropRect's width and
// height, so every triangle stretches with the screen (wide and flat on a
// landscape desktop, tall and narrow on a portrait tablet) instead of
// sitting at fixed pixel offsets like the old circles did. Deliberately
// different size and shape per slot — an even/symmetric set read as too
// mechanical. Per tier (currentViewportTier) because the same fractions
// don't read well on both a landscape and a portrait screen.
// Slots are place names, not actions — see the zones computed below for
// what each one does in Overview vs. Current.
type ZoneSize = Record<ViewportTier, [number, number]>
// `overview` optionally overrides a slot's size for Overview only (mode
// 'all', per tier) — the slots are shared with Current, but Overview has
// just two zones and room for a bigger one.
const ZONE_LAYOUT: Record<ZoneSlot, { corner: ZoneCorner; overview?: Partial<ZoneSize> } & ZoneSize> = {
  focus:  { corner: 'top-right',   phone: [0.41, 0.31], tablet: [0.37, 0.38], desktop: [0.45, 0.48], overview: { phone: [0.58, 0.38], tablet: [0.56, 0.45], desktop: [0.50, 0.53] } },
  date:   { corner: 'top-left',    phone: [0.50, 0.44], tablet: [0.51, 0.52], desktop: [0.42, 0.52] },
  delete: { corner: 'bottom-left', phone: [0.48, 0.24], tablet: [0.43, 0.23], desktop: [0.36, 0.33] },
  next:   { corner: 'bottom-right', phone: [0.36, 0.34], tablet: [0.38, 0.27], desktop: [0.27, 0.42] },
}

// Gap between each triangle and the edge of backdropRect — about half on
// phones, where every px of a narrow screen counts.
const ZONE_EDGE_INSET: Record<ViewportTier, number> = { phone: 8, tablet: 15, desktop: 15 }

// Builds one slot's triangle against the backdrop rect measured at drag
// start — the single geometry both hit-testing (zoneDepth) and rendering
// (zonePath) read from.
function buildZone(key: ZoneSlot, label: string, rect: { top: number; left: number; width: number; height: number }, overview: boolean): SwipeZone {
  const layout = ZONE_LAYOUT[key]
  const tier = currentViewportTier()
  const [fw, fh] = (overview && layout.overview?.[tier]) || layout[tier]
  const inset = ZONE_EDGE_INSET[tier]
  const right = layout.corner.endsWith('right')
  const bottom = layout.corner.startsWith('bottom')
  return {
    key,
    label,
    cornerX: right ? rect.left + rect.width - inset : rect.left + inset,
    cornerY: bottom ? rect.top + rect.height - inset : rect.top + inset,
    w: (right ? -1 : 1) * fw * rect.width,
    h: (bottom ? -1 : 1) * fh * rect.height,
  }
}

// What touches the zones while dragging: not the whole card (a tall card
// with its subs expanded would touch some triangle almost anywhere, leaving
// no free spot to drop it without firing anything) and not just the bare
// pointer either, but a contact box scaled off the card's own size — each
// side ZONE_CONTACT_SCALE of the card's (0.7² ≈ half its area), centered
// on the grip point and slid back inside the card where it would stick
// out. ZONE_CONTACT_MAX caps it in px so a very big card still leaves the
// middle free to drop it in.
const ZONE_CONTACT_SCALE = 0.7
const ZONE_CONTACT_MAX = { width: 360, height: 220 }

type ContactRect = { left: number; top: number; right: number; bottom: number }

// How deep a rect reaches into a zone, or null if it doesn't touch it.
// Measured at the rect's point closest to the zone's corner: how far along
// each leg that point sits (0 at the corner, 1 at the leg's far end) —
// touching while both are non-negative and together don't exceed 1 ("closer
// to the corner than the slanted edge"); smaller sum = deeper in.
function zoneDepth(zone: SwipeZone, rect: ContactRect): number | null {
  const px = Math.min(Math.max(zone.cornerX, rect.left), rect.right)
  const py = Math.min(Math.max(zone.cornerY, rect.top), rect.bottom)
  const u = (px - zone.cornerX) / zone.w
  const v = (py - zone.cornerY) / zone.h
  return u >= 0 && v >= 0 && u + v <= 1 ? u + v : null
}

// The zone the contact box reaches deepest into — a wide or tall box can
// touch two triangles at once (e.g. both top corners on a portrait tablet).
function deepestZoneHit(list: SwipeZone[], rect: ContactRect): ZoneSlot | null {
  let best: { key: ZoneSlot; depth: number } | null = null
  for (const zone of list) {
    const depth = zoneDepth(zone, rect)
    if (depth !== null && (!best || depth < best.depth)) best = { key: zone.key, depth }
  }
  return best?.key ?? null
}

function zoneVertices(zone: SwipeZone): [number, number][] {
  return [
    [zone.cornerX, zone.cornerY],
    [zone.cornerX + zone.w, zone.cornerY],
    [zone.cornerX, zone.cornerY + zone.h],
  ]
}

// SVG path for the triangle — always sharp-cornered, deliberately not
// tied to Settings' rounded/square (--radius).
function zonePath(zone: SwipeZone): string {
  return `M${zoneVertices(zone).map(p => p.join(',')).join('L')}Z`
}

// The three position slots (focus/date/delete) are reused as-is for
// Current's own swipe (mode 'current') — same geometry, different actions:
// the 'focus' slot becomes Done-for-now, the 'date' slot becomes Done,
// the 'delete' slot becomes Remove. Keeps one single hand-tuned layout
// instead of a second one to keep in sync, and means Current and Overview
// feel like the same gesture throughout the app rather than two
// different ones that happen to look similar.
//
// Overview (mode 'all'): only 'focus' (add to/remove from the list, see
// isOnList) and 'delete' — no 'date' slot.
//
// Current (mode 'current'): all three always apply, except previewLocked
// (browsing a future Date List via ListsPanel.vue) — Done/Done-for-now
// stay locked out there same as the check-row buttons do, leaving only
// Remove. Plus a fourth, 'next' (bottom right), with Date Lists on only:
// move to the next day's list — the same action as the card's own
// "move to next day" icon (nextListDate/moveToNextDay), so it's there
// exactly when that icon is, previews included.
// Every label a zone can show, per view and slot — the one place these
// strings live. zones picks the current one; zoneLabelLayout sizes against
// all of them, so the label size is identical in both views and doesn't
// change with the state of the card being dragged.
const ZONE_LABELS = {
  all: { focus: ['Add to list', 'Remove from list'], delete: ['Delete'] },
  current: { focus: ['Done.'], date: ['Done for now'], delete: ['Remove'], next: ['To next day'] },
} as const

const zones = computed<SwipeZone[]>(() => {
  const rect = backdropRect.value
  if (!rect) return []
  const list: SwipeZone[] = []

  if (props.mode === 'all') {
    list.push(buildZone('delete', ZONE_LABELS.all.delete[0], rect, true))
    // Date Lists on: this slot plans/unplans onto the selected date instead
    // of Current (see isOnSelectedFocusDate above) — Current has no UI of
    // its own to reuse a second zone for once Date Lists are on, so the
    // 'date' zone this used to sit next to is gone entirely.
    list.push(buildZone('focus', ZONE_LABELS.all.focus[isOnList.value ? 1 : 0], rect, true))
  } else {
    if (!props.previewLocked) {
      list.push(buildZone('focus', ZONE_LABELS.current.focus[0], rect, false))
      list.push(buildZone('date', ZONE_LABELS.current.date[0], rect, false))
    }
    list.push(buildZone('delete', ZONE_LABELS.current.delete[0], rect, false))
    if (nextListDate.value) list.push(buildZone('next', ZONE_LABELS.current.next[0], rect, false))
  }

  return list
})

// Every (slot, label) combination of both views, built against the same
// backdrop — what the shared label size is fitted to.
const allZoneLabelVariants = computed<SwipeZone[]>(() => {
  const rect = backdropRect.value
  if (!rect) return []
  const variants: SwipeZone[] = []
  for (const [view, slots] of Object.entries(ZONE_LABELS)) {
    for (const [key, labels] of Object.entries(slots)) {
      for (const label of labels) variants.push(buildZone(key as ZoneSlot, label, rect, view === 'all'))
    }
  }
  return variants
})

// Zone labels: one word per line, anchored in each triangle's right-angle
// corner — left corners left-aligned, right corners right-aligned, top
// corners stacking downward, bottom corners upward (the last word sits in
// the corner). One shared font size for every label of both views (see
// allZoneLabelVariants): the largest size at which every line of every
// possible label still fits inside its triangle, so the tightest
// triangle/longest word sets it everywhere — Overview and Current alike.
//
// Fit test per line: the line's outer corner (farthest from both legs) has
// to lie on or inside the slanted edge, i.e. x/W + y/H <= 1, with x =
// padX + text width and y = padY + (lines between it and the corner + 1) *
// line height. Everything scales with the font size, so it solves to a
// closed-form max size per line (see below) — widths are measured once at
// 100px via canvas in the labels' own font.
const ZONE_LABEL_PAD_X = 0.15 // em, air to the side edge — deliberately tight
const ZONE_LABEL_PAD_Y = 0.8 // em, air to the top/bottom edge
const ZONE_LABEL_LINE = 1 // em, line height
const ZONE_LABEL_ASCENT = 0.8 // em, assumed ink above the baseline if canvas measuring is unavailable
const ZONE_LABEL_MAX = 96 // px, cap for very large triangles
// Share of the largest fitting size actually used — 1 fills the tightest
// triangle edge to edge; below 1 leaves the labels a bit smaller.
const ZONE_LABEL_SCALE = 0.85
// Extra width per line for the heavy-type stroke (--zone-type-stroke, both
// sides) — keeps the measurement honest.
const ZONE_LABEL_STROKE_EM = 0.07
let zoneMeasureCtx: CanvasRenderingContext2D | null = null
// Width plus the word's actual ink above/below the baseline (all in em,
// stroke included) — the corner line is pulled flush to the edge by its
// real glyph bounds, not the line box: "now" is only x-height tall, so a
// fixed ascent left a visibly bigger gap above it than above "done".
function measureZoneWordEm(word: string): { width: number; ascent: number; descent: number } {
  zoneMeasureCtx ??= document.createElement('canvas').getContext('2d')
  if (!zoneMeasureCtx) return { width: word.length * 0.6, ascent: ZONE_LABEL_ASCENT, descent: ZONE_LABEL_LINE - ZONE_LABEL_ASCENT }
  zoneMeasureCtx.font = `900 100px ${getComputedStyle(document.body).fontFamily}`
  const m = zoneMeasureCtx.measureText(word)
  const halfStroke = ZONE_LABEL_STROKE_EM / 2
  return {
    width: m.width / 100 + ZONE_LABEL_STROKE_EM,
    ascent: m.actualBoundingBoxAscent / 100 + halfStroke,
    descent: Math.max(0, m.actualBoundingBoxDescent / 100) + halfStroke,
  }
}

interface ZoneLabelLine { text: string; x: number; y: number }
const zoneLabelLayout = computed(() => {
  const words = (zone: SwipeZone) => zone.label.toLowerCase().split(' ')
  // Distance (in lines) of line i from the zone's corner.
  const fromCorner = (zone: SwipeZone, i: number, n: number) => zone.h > 0 ? i : n - 1 - i
  // Largest size at which this zone's label still fits its own triangle.
  const fitSize = (zone: SwipeZone) => {
    const W = Math.abs(zone.w)
    const H = Math.abs(zone.h)
    const list = words(zone)
    return Math.min(...list.map((word, i) => {
      const k = fromCorner(zone, i, list.length)
      return W / (measureZoneWordEm(word).width + ZONE_LABEL_PAD_X + W * (ZONE_LABEL_PAD_Y + (k + 1) * ZONE_LABEL_LINE) / H)
    }))
  }
  const fontSize = Math.min(ZONE_LABEL_MAX, ...allZoneLabelVariants.value.map(fitSize)) * ZONE_LABEL_SCALE
  const lines: Partial<Record<ZoneSlot, ZoneLabelLine[]>> = {}
  const anchor: Partial<Record<ZoneSlot, 'start' | 'end'>> = {}
  const padX = ZONE_LABEL_PAD_X * fontSize
  const padY = ZONE_LABEL_PAD_Y * fontSize
  const lh = ZONE_LABEL_LINE * fontSize
  for (const zone of zones.value) {
    const list = words(zone)
    const x = zone.cornerX + Math.sign(zone.w) * padX
    anchor[zone.key] = zone.w > 0 ? 'start' : 'end'
    // Baseline of the line touching the corner edge, placed by that word's
    // real ink bounds; the others follow at a regular line height.
    const top = zone.h > 0
    const cornerWord = measureZoneWordEm(top ? list[0] : list[list.length - 1])
    const cornerBaseline = top
      ? zone.cornerY + padY + cornerWord.ascent * fontSize
      : zone.cornerY - padY - cornerWord.descent * fontSize
    lines[zone.key] = list.map((text, i) => {
      const k = fromCorner(zone, i, list.length)
      return { text, x, y: cornerBaseline + (top ? k : -k) * lh }
    })
  }
  return { fontSize, lines, anchor }
})

// Overview with Date Lists on: which list the 'focus' zone acts on, shown
// big and dead center while a card is gripped — the zone itself just says
// "add to list". A plain DD/MM date gets its weekday right above it, sized
// to the date's own width (measured like the zone labels) — today/tomorrow
// already say which day it is.
const ZONE_TARGET_TRACKING = 0.02 // em, matches .swipe-zones-target's letter-spacing
const zoneTargetLabel = computed(() => {
  const rect = backdropRect.value
  if (!rect || props.mode !== 'all' || !themeStore.dateListsEnabled) return null
  const dateStr = themeStore.selectedFocusDate
  const text = formatShortDate(dateStr)
  const [y, m, d] = dateStr.split('-').map(Number)
  const isNamed = dateStr === todayStr() || dateStr === tomorrowStr()
  const weekday = isNamed ? null : WEEKDAY_FULL_LABELS[new Date(y, m - 1, d).getDay()]
  const widthEm = (word: string) => measureZoneWordEm(word).width + word.length * ZONE_TARGET_TRACKING
  return {
    text,
    weekday,
    weekdaySize: weekday ? `${widthEm(text) / widthEm(weekday)}em` : undefined,
    style: {
      left: `${rect.left + rect.width / 2}px`,
      top: `${rect.top + rect.height / 2}px`,
      transform: 'translate(-50%, -50%)',
    },
  }
})



// The card's own viewport rect at grab time — onDrag shifts it by the
// drag offset (x/y) to know where the card currently is.
let gripCardRect: ContactRect | null = null

// The one authoritative "what would happen on release" state — the zones
// overlay and onDragEnd both read this, so what you see is what fires.
const zoneHit = ref<ZoneSlot | null>(null)

watch(zoneHit, (hit, prev) => {
  if (hit !== prev) navigator.vibrate?.(hit === null ? 8 : 12)
})

// Planning a todo onto a Date List doesn't move it anywhere (it stays put
// in Overview — see onDragEnd's focus-zone branch below) — this brief
// pulse is the only on-card feedback that anything happened at all, since nothing else
// about the card visually changes.
const justPlanned = ref(false)
function triggerPlannedPulse() {
  justPlanned.value = false
  requestAnimationFrame(() => {
    justPlanned.value = true
    setTimeout(() => { justPlanned.value = false }, 500)
  })
}

function animateOutPuff(): Promise<void> {
  const el = swipeContainerRef.value
  if (!el) return Promise.resolve()

  return el.animate(
    [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(1.08)', opacity: 0.6, offset: 0.18 },
      { transform: 'scale(0)', opacity: 0 },
    ],
    { duration: 300, easing: 'ease-in', fill: 'forwards' },
  ).finished.then(() => {})
}

// Sends the card flying off to the right on a confirmed focus-zone drop — but
// continuing on from wherever the drag actually released it (x/y aren't
// reset first), instead of the old version's snap-back-to-center-then-fly,
// which visibly jumped the card back to its start position for a frame
// before the fly-out began. `x` is the same motion value the drag itself
// was already driving, so this reads as one continuous motion.
function flyOutRight(): Promise<void> {
  const targetX = (x.get() > 0 ? x.get() : 0) + window.innerWidth * 1.5
  return Promise.all([
    animate(x, targetX, { duration: 0.24, ease: 'easeIn' }).finished,
    animate(cardOpacity, 0, { duration: 0.24, ease: 'easeIn' }).finished,
  ]).then(() => {})
}

// Mirrors flyOutRight for throwing a card back out of Current (remove zone,
// "Remove") — same continue-from-the-release-point logic, just leftward.
function flyOutLeft(): Promise<void> {
  const targetX = (x.get() < 0 ? x.get() : 0) - window.innerWidth * 1.5
  return Promise.all([
    animate(x, targetX, { duration: 0.24, ease: 'easeIn' }).finished,
    animate(cardOpacity, 0, { duration: 0.24, ease: 'easeIn' }).finished,
  ]).then(() => {})
}

// touch-action: pan-y means the browser is *allowed* to natively scroll the
// list at the same time Motion is handling our horizontal drag — on a
// diagonal-enough gesture both can end up running at once (card dragging
// while the list scrolls underneath it). Once Motion has actually committed
// to a drag, we lock the nearest scrollable ancestor's own scrolling for the
// duration, so gripping a card unambiguously owns the gesture.
//
// Pull-to-refresh is a separate, page-level overscroll-chaining gesture and
// can't be locked reactively here the same way: the browser decides whether
// to hand a touch to native pull-to-refresh right at touchstart, before any
// of this component's JS has run, so a fast downward drag can trigger it
// before onDragStart even fires. That's instead fixed permanently via
// `overscroll-behavior-y: contain` on .main-content (see layout.css), which
// stops the chaining at the CSS level from the very first touch, every time.
let scrollLockEl: HTMLElement | null = null

function lockScroll() {
  let node = swipeContainerRef.value?.parentElement ?? null
  while (node && node !== document.body) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) {
      scrollLockEl = node
      node.style.overflowY = 'hidden'
      return
    }
    node = node.parentElement
  }
}

function unlockScroll() {
  if (scrollLockEl) {
    scrollLockEl.style.overflowY = ''
    scrollLockEl = null
  }
}

// Safety net: if the gesture ever ends without Motion calling onDragEnd
// (a stray pointercancel, the tab losing focus mid-drag, etc.), the lock
// above would otherwise stay stuck forever — leaving .main-content
// permanently unscrollable, breaking things as unrelated as the
// scroll-into-view on opening the edit textarea. Same story for `isGripped`:
// stuck true would leave the card permanently position:fixed. Any pointer
// going up or cancelling anywhere always releases both, regardless of how
// the drag ended.
function releaseGripFallback() {
  unlockScroll()
  isGripped.value = false
  window.removeEventListener('pointerup', releaseGripFallback)
  window.removeEventListener('pointercancel', releaseGripFallback)
}

function armGripSafetyNet() {
  window.addEventListener('pointerup', releaseGripFallback, { once: true })
  window.addEventListener('pointercancel', releaseGripFallback, { once: true })
}

// `.main-content` (and similar scrollable ancestors) clip anything that's
// dragged past their own box edges via their own overflow — no z-index can
// out-rank that, it's a completely separate clipping mechanism. So while
// actually gripped, the card's wrapper switches to position:fixed at its
// current on-screen spot (escaping that clipping and any ancestor stacking
// entirely — it now paints at the true top of the page) and only returns to
// normal flow the instant the grip ends. Scroll is locked for the whole
// gripped duration anyway, so there's no risk of the fixed card drifting out
// of sync with a list that's scrolling underneath it.
const isGripped = ref(false)
const fixedOrigin = ref<{ top: number; left: number; width: number } | null>(null)
// Bounds of the dimming backdrop (see .swipe-zones-dim below) — matches the
// scroll-locked list container itself, so it only covers the todos and
// never bleeds over the top bar / bottom nav.
const backdropRect = ref<{ top: number; left: number; width: number; height: number } | null>(null)

function onDragStart() {
  justDragged = true
  dragEngaged = false
  releaseGripFallback() // in case a previous gesture didn't clean up
  lockScroll()
  armGripSafetyNet()
  isGripped.value = true
  zoneHit.value = null
  const rect = wrapRef.value?.getBoundingClientRect()
  if (rect) fixedOrigin.value = { top: rect.top, left: rect.left, width: rect.width }
  gripCardRect = rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null
  if (window.innerWidth > 700) {
    // Tablet and desktop both use the same grid layout with no fixed
    // top/bottom chrome fighting for the same space (that's mobile-only:
    // a sticky main-head + fixed bottom nav) — the backdrop can just cover
    // the whole viewport there instead of being clipped to the scroll
    // container, which on tablet is narrower than the full display width.
    backdropRect.value = { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
  } else {
    const listRect = scrollLockEl?.getBoundingClientRect()
    if (listRect) {
      // .main-content's own box still geometrically extends behind the
      // fixed mobile bottom nav (only its inner padding keeps content clear
      // of it) — clip the backdrop to stop at the nav's top edge instead of
      // matching the full box, or it visually covers the nav too.
      let height = listRect.height
      const bottomNav = document.querySelector<HTMLElement>('.mobile-bottom-nav')
      const navRect = bottomNav?.getBoundingClientRect()
      if (navRect && navRect.width > 0) height = Math.min(height, navRect.top - listRect.top)
      backdropRect.value = { top: listRect.top, left: listRect.left, width: listRect.width, height }
    }
  }
}

function onDrag(event: PointerEvent, info: PanInfo) {
  // Engage-then-follow gating — keeps a mostly-vertical touch free to
  // scroll the list natively instead of being claimed the instant any
  // drag starts.
  if (Math.abs(info.offset.x) > DRAG_ENGAGE_THRESHOLD) dragEngaged = true
  if (dragEngaged) y.set(info.offset.y)
  // clientX/clientY (viewport-relative), not info.point (page-relative,
  // includes scroll offset) — backdropRect is viewport-relative too
  // (getBoundingClientRect), so both sides of this comparison agree.
  // Contact box (see ZONE_CONTACT_SCALE) on the card's current position —
  // its grab-time rect shifted by the drag offset (the slight drag
  // rotation is ignored, a few px at most). A card grabbed while already
  // inside a zone counts as in it right away — dropping it there fires
  // that action, by design.
  let contact: ContactRect = { left: event.clientX, top: event.clientY, right: event.clientX, bottom: event.clientY }
  if (gripCardRect) {
    const cardLeft = gripCardRect.left + x.get()
    const cardTop = gripCardRect.top + y.get()
    const cardW = gripCardRect.right - gripCardRect.left
    const cardH = gripCardRect.bottom - gripCardRect.top
    const boxW = Math.min(cardW * ZONE_CONTACT_SCALE, ZONE_CONTACT_MAX.width)
    const boxH = Math.min(cardH * ZONE_CONTACT_SCALE, ZONE_CONTACT_MAX.height)
    const left = Math.min(Math.max(event.clientX - boxW / 2, cardLeft), cardLeft + cardW - boxW)
    const top = Math.min(Math.max(event.clientY - boxH / 2, cardTop), cardTop + cardH - boxH)
    contact = { left, top, right: left + boxW, bottom: top + boxH }
  }
  zoneHit.value = deepestZoneHit(zones.value, contact)
}

// Also settles scale back to 1 explicitly: `:while-drag`'s own 1.05 is
// meant to revert by itself on release, but with cardScale bound into
// :style Motion can resolve that revert's target to the dragged value and
// leave the card stuck puffed up (with the CSS hover puff stacking on top).
function springBackToCenter() {
  animate(x, 0, SPRING_BACK)
  animate(y, 0, SPRING_BACK)
  animate(cardScale, 1, SPRING_BACK)
}

// Reads the same `zoneHit` the overlay itself displays — whatever it was
// showing the instant the finger lifts is exactly what fires.
async function onDragEnd(_event: PointerEvent, _info: PanInfo) {
  // justDragged itself was already set in onDragStart — clearing it here
  // is just a delayed safety net in case no click ever follows at all
  // (e.g. the mouse was released off the card). See onDragStart for why it
  // isn't set here instead.
  setTimeout(() => { justDragged = false }, 300)
  window.removeEventListener('pointerup', releaseGripFallback)
  window.removeEventListener('pointercancel', releaseGripFallback)
  unlockScroll()
  isGripped.value = false

  if (props.mode === 'all') {
    const hit = zoneHit.value
    zoneHit.value = null
    if (hit === 'delete') {
      // Snap back first (no fly/puff yet), confirm, only then animate —
      // delete is permanent and easy to trigger by accident.
      x.set(0)
      y.set(0)
      pendingDelete.value = true
    } else if (hit === 'focus') {
      // Date Lists on: the todo never leaves Overview (it just moves
      // into/out of the selected list's group), so the card springs back
      // and pulses instead of flying off. Date Lists off is the old
      // single-Current-pool app: the todo genuinely leaves this list, so
      // it really does fly out.
      if (themeStore.dateListsEnabled) {
        springBackToCenter()
        // addToList pulses on its own; removing gets the same pulse here.
        if (isOnList.value) triggerPlannedPulse()
        toggleList()
      } else {
        await flyOutRight()
        toggleList()
      }
    } else {
      springBackToCenter()
    }
    return
  }

  // Same three slots as Overview (see zones computed) — 'focus' is
  // Done, 'date' is Done-for-now, 'delete' is Remove. Remove is
  // non-destructive (the todo just goes back to the pool), unlike
  // Overview's Delete, so no confirmation here. 'next' (Date Lists only)
  // moves it on to the next day's list — it leaves this one, so it flies
  // off toward its own corner, the opposite way from Remove.
  const hit = zoneHit.value
  zoneHit.value = null
  if (hit === 'delete') {
    await flyOutLeft()
    removeFromList()
  } else if (hit === 'next') {
    await flyOutRight()
    moveToNextDay()
  } else if (hit === 'date') {
    springBackToCenter()
    handleDoneForNow(props.todo.id)
  } else if (hit === 'focus') {
    springBackToCenter()
    handleComplete(props.todo.id)
  } else {
    springBackToCenter()
  }
}

// Shared by both delete paths (swipe and the open-card Delete button) —
// same puff-then-delete either way, once confirmed below.
async function deleteWithPuff() {
  await animateOutPuff()
  emit('delete', props.todo.id)
}

// Confirmation modal shared by both delete paths (swipe, see onDragEnd,
// and the open-card Delete button) — mirrors the tag-delete confirmation
// modal in App.vue, same markup/classes/style.
const pendingDelete = ref(false)

async function confirmDelete() {
  pendingDelete.value = false
  await deleteWithPuff()
}

function cancelDelete() {
  pendingDelete.value = false
}

watch(pendingDelete, (open) => {
  activeModal.value = open ? { onCancel: cancelDelete, onConfirm: confirmDelete } : null
})

onUnmounted(() => {
  pendingHalfHideTimers.forEach(timer => clearTimeout(timer))
  pendingHalfHideTimers.clear()
  cardResizeObserver?.disconnect()
  window.removeEventListener('pointerup', releaseGripFallback)
  window.removeEventListener('pointercancel', releaseGripFallback)
  window.removeEventListener('pointermove', onSubGripPointerMove)
  window.removeEventListener('pointerup', onSubGripPointerUp)
  window.removeEventListener('pointercancel', onSubGripPointerUp)
  unlockScroll()
  if (openTagMenuId.value === props.todo.id) openTagMenuId.value = null
  // The celebration teaser is driven centrally by App.vue's own watcher on
  // openCheckMenuId (see showCelebrationTeaser's own comment for why),
  // not by this card — so setting this to null here is enough on its own
  // to have it hidden, regardless of unmount timing.
  if (openCheckMenuId.value === props.todo.id) openCheckMenuId.value = null
  if (activeCardApi.value?.todoId === props.todo.id) activeCardApi.value = null
  // The showMenu/showTagMenu watch above is normally what removes these —
  // but that's a queued job, and this component can unmount in the very
  // same flush that set showMenu/showTagMenu back to false (e.g. Done for
  // today: openCheckMenuId is nulled synchronously, then the emit removes
  // this todo from Current's list, unmounting it). When the parent's removal
  // job runs first, this component's own effect scope is stopped before
  // its pending watcher job runs, and it's silently skipped — leaving
  // these two document listeners (from a now-destroyed card, still
  // closing over its stale todo/props) attached forever. Removing them
  // here too is idempotent (harmless if the watcher already did it).
  document.removeEventListener('click', closeOnOutside)
  document.removeEventListener('keydown', onCardKeydown)
})
</script>

<template>
  <div
    ref="wrapRef"
    class="todo-card-wrap"
    :class="{ 'tag-editing': showTagMenu, 'subs-expanded': subsExpandedWide, dragging: isLifted }"
    :style="isGripped && fixedOrigin ? {
      position: 'fixed',
      top: fixedOrigin.top + 'px',
      left: fixedOrigin.left + 'px',
      width: fixedOrigin.width + 'px',
      zIndex: 9999,
    } : undefined"
  >
    <motion.div
      class="todo-card-enter"
      :initial="enterInitial"
      :animate="{ opacity: 1, y: 0, scale: 1 }"
      :transition="{ ...ENTER_SPRING, delay: enterDelay }"
    >
    <div
      ref="swipeContainerRef"
      class="swipe-container"
      :class="{ open: showMenu || showTagMenu, loop: previewIsLoop, 'just-planned': justPlanned }"
      :style="{ '--hover-scale': hoverScale }"
    >
      <!-- Swipe zones overlay. One viewport-sized SVG in the
           same coordinate space onDrag's hit-testing uses (event.clientX/
           clientY), teleported to body so no ancestor's overflow/stacking
           context can clip it — every triangle's path, label position and
           hit area all come from the same zones geometry. -->
      <Teleport to="body">
        <Transition name="swipe-zones-fade">
          <div v-if="isGripped" class="swipe-zones-layer">
            <div
              v-if="backdropRect"
              class="swipe-zones-dim"
              :style="{ top: backdropRect.top + 'px', left: backdropRect.left + 'px', width: backdropRect.width + 'px', height: backdropRect.height + 'px' }"
            />
            <svg class="swipe-zones-svg">
              <g
                v-for="zone in zones"
                :key="zone.key"
                class="swipe-zone-tri"
                :class="{ armed: zoneHit === zone.key }"
                :style="{ transformOrigin: `${zone.cornerX}px ${zone.cornerY}px` }"
              >
                <path class="swipe-zone-shape" :d="zonePath(zone)" />
                <text
                  class="swipe-zone-label"
                  :font-size="zoneLabelLayout.fontSize"
                  :text-anchor="zoneLabelLayout.anchor[zone.key]"
                >
                  <tspan
                    v-for="(line, i) in zoneLabelLayout.lines[zone.key]"
                    :key="i"
                    :x="line.x"
                    :y="line.y"
                  >{{ line.text }}</tspan>
                </text>
              </g>
            </svg>
          </div>
        </Transition>
        <!-- Own layer above the dragged card (z-index 9999), so the card
             slides underneath the target date instead of covering it. -->
        <Transition name="swipe-zones-fade">
          <div v-if="isGripped && zoneTargetLabel" class="swipe-zones-front">
            <div class="swipe-zones-target" :style="zoneTargetLabel.style">
              <span v-if="zoneTargetLabel.weekday" class="swipe-zones-target-weekday" :style="{ fontSize: zoneTargetLabel.weekdaySize }">{{ zoneTargetLabel.weekday }}</span>
              <span>{{ zoneTargetLabel.text }}</span>
            </div>
          </div>
        </Transition>
      </Teleport>

      <Teleport to="body">
        <template v-if="pendingDelete">
          <div class="modal-backdrop" @click="cancelDelete" />
          <div class="modal-box" role="dialog">
            <p class="modal-text">Delete <strong>{{ todo.title }}</strong>?</p>
            <div class="modal-actions">
              <button class="modal-btn modal-btn--cancel" @click="cancelDelete">cancel</button>
              <button class="modal-btn modal-btn--delete" @click="confirmDelete">delete</button>
            </div>
          </div>
        </template>
      </Teleport>

      <motion.div
        class="todo-card"
        :data-todo-id="todo.id"
        :class="{ 'has-tags': todo.tags.length, 'is-open': showMenu, priority: previewIsPriority, loop: previewIsLoop }"
        :style="{ x, y, rotate, opacity: cardOpacity, scale: cardScale }"
        :drag="canDrag ? 'x' : false"
        :drag-momentum="false"
        :while-drag="{ scale: 1.05 }"
        @drag-start="onDragStart"
        @drag="onDrag"
        @drag-end="onDragEnd"
      >
        <div
          class="todo-card-main"
          @click.stop="mode === 'current' ? toggleCheckMenu() : toggleTagMenu()"
        >
          <textarea
            v-if="isEditing"
            ref="editInputRef"
            v-model="editTitle"
            class="title-input"
            rows="1"
            :style="font ? { fontFamily: font } : {}"
            @keydown.enter.prevent.stop="acceptEdit"
            @keydown.escape.stop="cancelEdit"
            @keydown="onTitleTabKeydown"
            @blur="saveEdit"
            @input="autoGrow"
            @click.stop
          />
          <span
            v-else
            ref="titleRef"
            class="todo-title"
            :class="{ editable: mode === 'current' ? (showMenu || showTagMenu) : showTagMenu }"
            :style="font ? { fontFamily: font } : {}"
            @click.stop="handleTitleClick"
          ><LinkifiedText :text="todo.title" /></span>

          <!-- When card is open (either mode) and not editing: just Delete —
               clicking the title text itself now starts editing directly
               (handleTitleClick), so no separate Edit trigger is needed here
               any more. Delete only lives here — not on the closed card — so
               it isn't a single stray click away during normal browsing. -->
          <template v-if="showTagMenu && !isEditing">
            <button
              class="card-btn card-btn--delete"
              v-tooltip="'delete'"
              @click.stop="pendingDelete = true"
            >
              <Trash2 :size="18" />
            </button>
          </template>

          <!-- Saves and drops back to the open (non-editing) card. mousedown.prevent
               keeps the textarea focused through the click — otherwise its
               own blur (from focus moving to this button) runs saveEdit and
               flips isEditing to false *before* the click fires, swapping
               this button out for the Edit one mid-click so the click lands
               on nothing/the wrong button instead of accepting the edit. -->
          <template v-else-if="showTagMenu && isEditing">
            <button class="card-btn card-btn--circle" v-tooltip="'accept'" @mousedown.prevent @click.stop="acceptEdit">
              <Check :size="11" />
            </button>
          </template>

          <!-- Closed card, not on the list (Overview only, see isOnList):
               a single add icon. Delete lives in the open state, see
               above. -->
          <template v-else-if="!isOnList">
            <button class="card-btn" v-tooltip="'add to list'" @click.stop="addToList()">
              <CirclePlus :size="18" />
            </button>
          </template>

          <!-- List actions, for every card that's on the list (see
               isOnList) — Overview and Current alike: quick priority
               toggle, move to the next day's list (Date Lists only),
               remove from the list.
               No separate "active" tint on the flag: the whole card
               already goes ink-colored once priority is on (see .priority
               above), so layering ink-dark on top of that would just read
               as low contrast rather than a clearer state. Stays visible
               even once a Current card is open — clicking the title text
               starts editing directly (handleTitleClick), so this slot
               doesn't need to swap to an Edit trigger. -->
          <div v-else class="card-list-actions">
            <button
              class="card-btn card-btn--circle"
              v-tooltip="isPriority ? 'unset priority' : 'set priority'"
              @click.stop="togglePriority"
            >
              <Flag :size="10" :fill="isPriority ? 'currentColor' : 'none'" />
            </button>
            <button
              v-if="nextListDate"
              class="card-btn"
              v-tooltip="'move to next day'"
              @click.stop="moveToNextDay"
            >
              <CircleArrowRight :size="18" />
            </button>
            <button
              class="card-btn"
              v-tooltip="'remove from list'"
              @click.stop="removeFromList()"
            >
              <CircleMinus :size="18" />
            </button>
          </div>
        </div>

        <Transition :css="false" @enter="onExpandEnter" @leave="onExpandLeave">
          <div v-if="subsVisible && (visibleSubs.length > 0 || subsAddVisible)" ref="subRowContainerRef" class="sub-row" @click.stop>
            <div
              v-for="sub in visibleSubs"
              :key="sub.id"
              :ref="(el) => registerSubRowEl(sub.id, el as Element | null)"
              :data-flip-id="sub.id"
              class="sub-item"
              :class="{ dragging: dragSubId === sub.id, 'sub-item--leaving': halfHiddenLeavingIds.has(sub.id) }"
              :style="subRowStyle(sub)"
            >
              <button
                type="button"
                class="sub-box"
                :class="{ checked: !!sub.completedAt }"
                v-tooltip="'toggle sub'"
                @click.stop="handleToggleSub(sub, $event)"
              >
                <Check v-if="sub.completedAt" :size="10" />
              </button>
              <textarea
                v-if="editingSubId === sub.id"
                :ref="(el) => { editSubInputRef = el as HTMLTextAreaElement | null }"
                v-model="editSubTitle"
                class="sub-input"
                rows="1"
                :style="font ? { fontFamily: font } : {}"
                @input="autoGrowEditSub"
                @keydown="onEditSubKeydown"
                @blur="saveEditSub"
                @click.stop
              />
              <span
                v-else
                class="sub-title"
                :class="{ done: !!sub.completedAt }"
                :style="font ? { fontFamily: font } : {}"
                @click.stop="handleSubTitleClick(sub, $event)"
              ><LinkifiedText :text="sub.title" /></span>

              <button
                v-if="editingSubId === sub.id"
                type="button"
                class="sub-edit"
                v-tooltip="'save'"
                @mousedown.prevent
                @click.stop="saveEditSub"
              >
                <Check :size="11" />
              </button>

              <button
                v-if="!sub.completedAt && uncheckedSubsCount > 1"
                type="button"
                class="sub-grip"
                v-tooltip="'drag to reorder'"
                @pointerdown="onSubGripPointerDown(sub, $event)"
                @click.stop
              >
                <GripVertical :size="12" />
              </button>

              <button
                type="button"
                class="sub-promote"
                v-tooltip="'make own todo'"
                @click.stop="promoteSubToTodo(sub)"
              >
                <ArrowUpRight :size="12" />
              </button>

              <button
                type="button"
                class="sub-delete"
                v-tooltip="'delete sub'"
                @click.stop="handleDeleteSub(sub.id)"
              >
                <Trash2 :size="12" />
              </button>
            </div>

            <div v-if="completedSubsHintCount > 0" class="sub-item sub-item--hint">
              <button
                type="button"
                class="sub-hint-btn"
                v-tooltip="doneSubsRevealed ? 'hide done subs' : 'show done subs'"
                @click.stop="toggleDoneSubsReveal"
              >
                <ChevronDown v-if="doneSubsRevealed" :size="17" :stroke-width="3" />
                <ChevronUp v-else :size="17" :stroke-width="3" />
              </button>
              <span
                class="sub-hint-text"
                :style="font ? { fontFamily: font } : {}"
                @click.stop="toggleDoneSubsReveal"
              >({{ completedSubsHintCount }} done)</span>
            </div>

            <div v-if="subsAddVisible" class="sub-item sub-item--add">
              <span class="sub-box sub-box--empty" aria-hidden="true" />
              <div class="sub-input-wrap">
                <textarea
                  ref="newSubInputRef"
                  v-model="newSubTitle"
                  class="sub-input sub-input--new"
                  rows="1"
                  placeholder="add sub + enter"
                  :style="font ? { fontFamily: font } : {}"
                  @input="autoGrowSub"
                  @keydown="onSubInputKeydown"
                  @focus="promoteFromSubInteraction"
                  @click.stop
                />
                <button
                  v-if="newSubTitle.length"
                  type="button"
                  class="sub-input-clear"
                  v-tooltip="'clear'"
                  @mousedown.prevent="clearNewSubInput"
                >
                  <X :size="9" />
                </button>
              </div>
            </div>
          </div>
        </Transition>

        <Transition :css="false" @enter="onExpandEnter" @leave="onExpandLeave">
          <div v-if="showMenu && mode === 'current'" class="check-row">
            <span v-if="previewLocked" class="check-opt check-opt--locked" v-tooltip="'this day hasn\'t arrived yet'">
              <Clock :size="16" /> <span>not due yet</span>
            </span>
            <template v-else>
              <button
                class="check-opt"
                :class="{ 'is-focused': focusedCheckOption === 'now' }"
                @click.stop="handleDoneForNow(todo.id)"
              >
                <Clock :size="16" /> <span>done for now</span>
              </button>
              <button
                class="check-opt"
                :class="{ 'is-focused': focusedCheckOption === 'done' }"
                @click.stop="handleComplete(todo.id)"
              >
                <CheckCheck :size="16" /> <span>done</span>
              </button>
            </template>
          </div>
        </Transition>

        <Transition :css="false" @enter="onExpandEnter" @leave="onExpandLeave">
          <div v-if="showTagMenu" class="tag-row" @click.stop="handleTagRowClick">
            <Transition :css="false" @enter="onQuickExpandEnter" @leave="onQuickExpandLeave">
              <div v-if="draftIsLoop" class="add-loop-row" @click.stop>
                <LoopPicker :model-value="draftLoopInterval" :inverted="draftIsPriority" :settled-today="isLoopSettledToday(todo)" @update:model-value="updateDraftLoopInterval" />
              </div>
            </Transition>

            <template v-if="tagMenuTags.length">
              <div v-if="tagMenuPinnedTags.length" class="tag-row-pinned">
                <label
                  v-for="tag in tagMenuPinnedTags"
                  :key="tag.id"
                  class="tag-row-opt"
                  :class="{ checked: draftTags.includes(tag.id), dimmed: draftTags.length > 0 && !draftTags.includes(tag.id) }"
                  @click.stop
                >
                  <input type="checkbox" :checked="draftTags.includes(tag.id)" @change="updateDraftTags(draftTags.includes(tag.id) ? draftTags.filter(i => i !== tag.id) : [...draftTags, tag.id])" />
                  <span>{{ tag.label }}</span>
                </label>
              </div>
              <label
                v-for="tag in tagMenuRestTags"
                :key="tag.id"
                class="tag-row-opt"
                :class="{ checked: draftTags.includes(tag.id), dimmed: draftTags.length > 0 && !draftTags.includes(tag.id) }"
                @click.stop
              >
                <input type="checkbox" :checked="draftTags.includes(tag.id)" @change="updateDraftTags(draftTags.includes(tag.id) ? draftTags.filter(i => i !== tag.id) : [...draftTags, tag.id])" />
                <span>{{ tag.label }}</span>
              </label>
              <TagInlineCreate v-if="themeStore.tagsEnabled" @created="onCardTagCreated" />
            </template>
            <span v-else class="tag-row-empty">no tags yet</span>
          </div>
        </Transition>
      </motion.div>

      <!-- Sibling to .todo-card, not a child of it — .todo-card has its
           own overflow:hidden (for the check-row/tag-row corners, see
           comment near .swipe-container.loop::before) which would clip
           this if it lived inside and hung half off the edge. Bound to
           the exact same x/y/rotate/opacity/scale motion values as
           .todo-card's own :style, so it rides along with every
           drag/fly-out/regrow in lockstep without any of the double-transform math a
           parent-child version would need — two independent elements
           moving by the same amount reads identically to one element
           carrying the other. The centering-on-the-corner offset itself
           (translate(-50%,-50%)) has to live on the *inner* .loop-badge
           span instead of this motion.div — motion-v owns this element's
           own `transform` via x/y/rotate, and a plain CSS transform here
           would just get overwritten by that inline style. -->
      <motion.div
        v-if="isRecurring"
        class="loop-badge-motion"
        :style="{ x, y, rotate, opacity: cardOpacity, scale: cardScale }"
      >
        <span class="loop-badge">
          <RefreshCw :size="12" />
        </span>
      </motion.div>
    </div>
    </motion.div>
  </div>
</template>

<style scoped>
.todo-card-wrap {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  /* Leaves a sliver of breathing room above the card when scrollIntoView
     (see scrollCardIntoView) snaps its top edge to the viewport — flush
     against the edge read as jarring. Same at the bottom for revealCard's
     keyboard cycling. */
  scroll-margin-top: 16px;
  scroll-margin-bottom: 16px;
}

/* Lifts the gripped card above every sibling card (which would otherwise
   paint over it per normal DOM order) and above the sticky mobile header /
   bottom nav (both z-index: 20, see mobile.css) while it's being dragged
   around freely. */
.todo-card-wrap.dragging {
  z-index: 25;
}

/* Purely a layout pass-through for the entrance-bounce motion.div — same
   inline-flex/stretch as .todo-card-wrap so wrapping it doesn't change how
   .swipe-container is sized inside. */
.todo-card-enter {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
}

/* No overflow:hidden here — the dragged card must stay fully visible while
   it's pulled past the reveal panels, instead of getting clipped away at the
   container edge (which reads as if the delete already fired mid-drag). */
.swipe-container {
  position: relative;
  display: inline-flex;
  transition: transform 0.15s;
}

/* Closed cards puff up a touch on hover — real mouse devices only (see
   other (hover: hover) blocks in this file), and skipped while open so
   the menu/edit UI underneath doesn't shift while you're using it.
   scale() is layout-neutral (grows around the element's own center
   without displacing flex siblings), so the fixed 12px gap in
   .todo-wrap's parent never accounts for it — invisible on a short card,
   but a tall one (many subs expanded) would puff up by enough real pixels
   at each edge to eat into or cross that gap. --hover-scale (set inline,
   see hoverScale below) caps the growth in actual pixels instead of a
   flat percentage, computed off this card's own measured height, so a
   tall card still puffs, just by less. */
@media (hover: hover) {
  .swipe-container:not(.open):hover {
    transform: scale(var(--hover-scale, 1.035));
  }
}

/* The only on-card feedback that planning onto a Date List actually did
   something (see justPlanned/triggerPlannedPulse) — the card itself never
   moves or leaves Overview, so this has to read as "yes, that landed"
   entirely on its own. */
@keyframes planned-pulse {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.06); }
  100% { transform: scale(1); }
}

.swipe-container.just-planned .todo-card {
  animation: planned-pulse 0.4s ease-out;
}

/* ── Swipe zones (see zones/zoneHit) ── */
.swipe-zones-fade-enter-active,
.swipe-zones-fade-leave-active {
  transition: opacity 0.1s ease;
}

.swipe-zones-fade-enter-from,
.swipe-zones-fade-leave-to {
  opacity: 0;
}

.swipe-zones-layer,
.swipe-zones-front {
  position: fixed;
  inset: 0;
  z-index: 5000;
  pointer-events: none;
  /* Heavy display type shared by the zone labels and the big target date
     (.swipe-zones-target). The UI font is user-picked and often only
     ships up to bold, so the weight alone wouldn't thicken it — a stroke
     in the text's own color adds weight for every font. Keep the weight
     in sync with measureZoneWordEm's canvas font. */
  --zone-type-weight: 900;
  --zone-type-stroke: 0.035em;
}

/* Above the dragged card (z-index 9999, see the wrapper's fixedOrigin
   style) — the target date stays readable while the card passes under it. */
.swipe-zones-front {
  z-index: 10000;
}

/* Constant while a card is gripped, not toggled per zone — the rest of
   the app recedes as soon as a card is gripped, not only once a specific
   zone is hit. The dragged card itself stays on top of this (z-index:
   9999, see the wrapper's fixedOrigin style). */
.swipe-zones-dim {
  position: fixed;
  background: var(--ink);
  opacity: 0.35;
}

.swipe-zones-svg {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.swipe-zone-tri {
  opacity: 0.6;
  transition: opacity 0.15s, transform 0.15s;
}

/* Grows out of its own right-angle corner (transform-origin set inline,
   see the template) rather than its center, so it stays tucked into the
   corner instead of drifting off it. */
.swipe-zone-tri.armed {
  opacity: 1;
  transform: scale(1.06);
}

.swipe-zone-shape {
  fill: var(--bg);
  stroke: var(--ink);
  stroke-width: 2px;
  transition: fill 0.15s;
}

.swipe-zone-tri.armed .swipe-zone-shape {
  fill: var(--ink);
}

.swipe-zone-label {
  /* Size, anchor and line positions come from zoneLabelLayout (attributes
     on the <text>/<tspan>s) — no font-size here, CSS would override them. */
  color: var(--ink);
  fill: currentColor;
  stroke: currentColor;
  stroke-width: var(--zone-type-stroke);
  paint-order: stroke fill;
  font-weight: var(--zone-type-weight);
}

.swipe-zone-tri.armed .swipe-zone-label {
  color: var(--bg);
}

/* The selected Date List's name (see zoneTargetLabel), big in the free
   center — reads against the ink dim like the triangles'
   own armed state does (bg on ink). Same heavy type as the zone labels
   (see .swipe-zones-layer). */
.swipe-zones-target {
  position: fixed;
  color: var(--bg);
  font-size: 128px;
  font-weight: var(--zone-type-weight);
  -webkit-text-stroke: var(--zone-type-stroke) currentColor;
  paint-order: stroke fill;
  line-height: 0.8;
  text-transform: lowercase;
  letter-spacing: 0.02em;
  white-space: nowrap;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Weekday above a DD/MM date — font-size (em of the date) set inline by
   zoneTargetLabel so it spans the date's width. */
.swipe-zones-target-weekday {
  margin-bottom: 0.35em;
}

@media (max-width: 700px) {
  .swipe-zones-target {
    font-size: 72px;
  }
}

.todo-card {
  /* Feeds .sub-box's own drop shadow below — a plain `.priority .sub-box`
     override rule for just that one property was silently lost in the
     production build (the minifier collapsed it into the later, unrelated
     `.sub-box` rule sharing the same bare selector once its `.priority `
     ancestor prefix got optimized away). Routing it through one shared
     custom property means there's only ever one box-shadow declaration
     for .sub-box to begin with, so there's nothing left to collide. */
  --sub-shadow: var(--priority-shadow);
  display: inline-flex;
  flex-direction: column;
  background: var(--bg);
  font-size: var(--card-font-size);
  color: var(--ink);
  max-width: 600px;
  border-radius: var(--radius);
  border: 2px solid var(--ink);
  box-shadow: var(--card-shadow-offset) var(--card-shadow-offset) 0 var(--ink);
  overflow: hidden;
  transition: border-color 0.12s, box-shadow 0.12s;
}

/* While editing a todo's tags, or while a force-expanded-but-still-closed
   card is showing its subs to skim (subsExpandedWide in the script), the
   card grows to fill the row's available width instead of staying
   shrink-to-fit around the title — same idea as .add-tag-row's dropdown,
   just by widening the card itself rather than floating a separate
   overlay. Long tag labels/sub-lists get room to breathe and still
   truncate/wrap via their own rules if they exceed even that. One shared
   rule for both triggers (rather than two separately stated but identical
   ones) — same effect, same reason, so a future change to it only needs
   one place. */
.todo-card-wrap.tag-editing,
.todo-card-wrap.tag-editing .swipe-container,
.todo-card-wrap.tag-editing .todo-card,
.todo-card-wrap.subs-expanded,
.todo-card-wrap.subs-expanded .swipe-container,
.todo-card-wrap.subs-expanded .todo-card {
  width: 100%;
}

/* .todo-card's own max-width:600px (below) exists to stop short-title
   cards from stretching absurdly wide on desktop — but it also caps the
   width:100% above, so on wide desktop rows the widened card stalls at
   600px instead of actually filling the row. Only lift it while editing
   or force-expanded (see above). */
.todo-card-wrap.tag-editing .todo-card,
.todo-card-wrap.subs-expanded .todo-card {
  max-width: none;
}

.todo-card.priority {
  /* --priority-shadow itself is an ink shade — invisible against this
     card's own ink-colored fill below, unlike on the normal bg-colored
     card --sub-shadow's base value (above) was designed for. bg is the
     one color that always contrasts against ink. */
  --sub-shadow: var(--bg);
  border-color: var(--ink);
  box-shadow: var(--card-shadow-offset) var(--card-shadow-offset) 0 var(--priority-shadow);
  background: var(--ink);
  color: var(--bg);
}

.priority .card-btn {
  color: var(--bg);
}

/* Small recurring-loop marker — the only visual difference between a
   once (single due date) and loop (recurring) Date todo, both of which
   otherwise look identical. Sits centered right on the card's top-left
   corner tip as its own layer on top, deliberately hanging half outside
   the card rather than sitting inset inside it (and not affecting the
   card's own size at all, being fully position:absolute). See the
   template comment above for why this is two nested elements instead of
   one. `.loop-badge-motion` just anchors to .swipe-container's own
   (0,0) — matching .todo-card's own corner exactly, since swipe-container
   has no padding/border of its own around it — and carries the drag
   transform; `.loop-badge` does the actual static corner-centering. */
.loop-badge-motion {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  pointer-events: none;
}

/* Always ink, priority included — unlike .card-btn etc. this badge sits
   half outside the card itself (over the page's own --bg), so swapping
   to --bg on a priority card would make that outside half disappear
   against it. Kept a single consistent color instead. */
.loop-badge {
  position: absolute;
  top: 0;
  left: 0;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink);
}

/* Scoped to real hover devices — on touch, :hover applies right after a
   tap and sticks until something else is tapped, so mobile action icons
   would otherwise look permanently "hovered" after use. */
@media (hover: hover) {
  .priority .card-btn:hover {
    color: var(--ink);
  }
}

.priority .check-row {
  border-top-color: var(--bg);
}

.priority .check-opt {
  background: var(--ink);
  color: var(--bg);
}

.priority .tag-row {
  border-top-color: var(--bg);
}

.priority .tag-row-opt {
  color: var(--bg);
  border-color: var(--bg);
}

.priority .tag-row-opt.checked {
  color: var(--bg);
  border-color: var(--bg);
}

.priority .tag-row-opt.dimmed {
  opacity: 0.35;
}

.priority .sub-box {
  border-color: var(--bg);
  color: var(--ink);
  /* Shadow itself is handled by --sub-shadow, set on .todo-card.priority
     — see that rule's own comment. */
}

.priority .sub-box.checked {
  background: var(--bg);
}

.priority .sub-edit,
.priority .sub-promote,
.priority .sub-delete,
.priority .sub-grip {
  color: var(--bg);
}

.priority .sub-input-clear {
  border-color: var(--bg);
  color: var(--bg);
}

.priority .sub-input {
  border-bottom-color: var(--bg);
}

.priority .sub-input--new {
  border-bottom-color: transparent;
}

.priority .sub-input--new:focus {
  border-bottom-color: var(--bg);
}

.priority .sub-input::placeholder {
  color: var(--bg);
}

/* Loop cards: border + drop shadow + fill, all in pale ink (the "faded
   priority" look), text untouched. .todo-card itself goes fully
   transparent (bg, border, shadow) — just a frame around the text — and
   one pseudo on .swipe-container redraws all three together, so the
   border and the fill meet flush with no seam between them (splitting
   fill from border/shadow across two differently-inset boxes, as before,
   left a ring of the normal opaque background showing between them).
   It has to live on .swipe-container rather than .todo-card because
   .todo-card has its own overflow:hidden (for its internal
   check-row/tag-row corners), which would clip the shadow.
   Negative z-index sits it below .todo-card's own in-flow content (text)
   instead of covering it; position+z-index together pin a local stacking
   context on .swipe-container itself, otherwise z-index:-1 would escape
   outward past it entirely. */
.todo-card.loop {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

.swipe-container.loop {
  position: relative;
  z-index: 0;
}

.swipe-container.loop::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--ink);
  border: 2px solid var(--ink);
  /* Unlike the fill/border, the shadow follows the Mono/Dark drop-shadow
     setting (--priority-shadow) — same as priority cards — instead of
     always being plain ink. */
  box-shadow: var(--card-shadow-offset) var(--card-shadow-offset) 0 var(--priority-shadow);
  opacity: 0.35;
  border-radius: var(--radius);
  z-index: -1;
  pointer-events: none;
  transition: opacity 0.12s;
}

/* This pseudo lives on .swipe-container (see comment above) while the
   drag transform lives on .todo-card, one level in — so during an actual
   swipe the text moves and this fill/border/shadow doesn't, visibly
   splitting the card in two. Hiding it for the duration of the drag (it
   reappears the instant the card settles back at rest) reads far better
   than a card that visibly tears apart mid-swipe. */
.todo-card-wrap.dragging .swipe-container.loop::before {
  opacity: 0;
}

/* ...and in its place, a plain ink border on .todo-card itself, which
   does travel with the drag — so the gripped card still reads as a card,
   not just loose text. Border only: the pale fill can't move here (it
   would need either opacity on .todo-card, dimming the text too, or an
   in-between color). Priority+loop already has a solid ink border. */
.todo-card-wrap.dragging .todo-card.loop {
  border-color: var(--ink);
}

/* Priority + loop together: full solid ink fill/border like plain
   priority (text already reads var(--bg) from .priority, untouched here)
   but the drop shadow stays the loop's pale ink instead of priority's
   solid one. No new pseudo needed — .swipe-container.loop::before above
   still draws its pale border+fill+shadow underneath, but this rule's
   opaque background/border sit on top and fully mask the pale border and
   fill (same position, same size); only the shadow, which spills outside
   the card's own box, isn't covered by anything and stays visible. */
.todo-card.priority.loop {
  background: var(--ink);
  border-color: var(--ink);
  box-shadow: none;
}

.todo-card-main {
  display: flex;
  align-items: flex-start;
  gap: var(--icon-title-gap);
  padding: 12px 18px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.todo-title {
  flex: 1;
  min-width: 0;
  white-space: normal;
  word-break: break-word;
  line-height: 1.35;
}

.todo-title.editable {
  cursor: text;
}

.card-btn {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  color: var(--ink);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: color 0.12s;
}

.card-btn.active { color: var(--ink-dark); }

/* Hover swaps the icon to the card's own background color, same idea as
   priority's bg<->ink swap below — the icon blends into the card itself
   rather than just shifting to a nearby shade of ink, which barely read
   as a change at all. */
@media (hover: hover) {
  .card-btn:hover {
    color: var(--bg);
  }

  .priority .card-btn:hover {
    color: var(--ink);
  }
}

/* The list-action trio — the icons sit closer together than the distance
   to the title: the same spacing as Current's yesterday icons
   (--icon-row-gap, --card-icon-gap-tablet), while the distance to the
   title is .todo-card-main's gap (--icon-title-gap, also shared with
   yesterday; phone: its own, see the phone block). */
.card-list-actions {
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
  gap: var(--icon-row-gap);
}

@media (min-width: 701px) and (max-width: 1024px) {
  .card-list-actions {
    gap: var(--card-icon-gap-tablet);
  }
}

@media (max-width: 700px) {
  .card-list-actions {
    gap: 8px;
  }
}

/* Deliberately no align-self override — this sits in the exact same spot
   as the plain trash/plus/minus icons (which rely on .todo-card-main's own
   flex-start alignment), just swapped in conditionally. Same size as every
   other small icon circle in the app (.icon-circle-btn, base.css) at every
   width — circle and the icon inside it both from the shared tokens. */
.card-btn--circle {
  justify-content: center;
  width: var(--icon-circle-btn-size);
  height: var(--icon-circle-btn-size);
  border-radius: 50%;
  border: 1.5px solid currentColor;
}

.card-btn--circle svg {
  width: var(--icon-circle-glyph-size);
  height: var(--icon-circle-glyph-size);
}

/* Bare Lucide icons (CirclePlus/CircleMinus/CircleArrowRight/Trash2): sized
   so their drawn circle matches .card-btn--circle's (see
   --icon-bare-size). */
.card-btn:not(.card-btn--circle) svg {
  width: var(--icon-bare-size);
  height: var(--icon-bare-size);
}

.title-input {
  display: block;
  flex: 1;
  min-width: 0;
  width: 100%;
  background: none;
  border: none;
  border-bottom: 1px solid var(--ink);
  outline: none;
  resize: none;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: inherit;
  font-family: inherit;
  color: inherit;
  padding: 0 0 4px;
  line-height: 1.35;
}

/* Priority cards already sit on an ink-colored highlight (see .priority
   .todo-card below) — the underline needs to be the background color to
   still read against it, instead of the ink color normal cards use. */
.priority .title-input {
  border-bottom-color: var(--bg);
}

.check-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.check-opt {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 8px;
  background: none;
  border: none;
  font-size: 13px;
  color: var(--ink);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.1s;
}

@media (hover: hover) {
  .check-opt:hover {
    color: var(--ink-dark);
  }
}

.check-opt--locked {
  cursor: default;
  opacity: 0.4;
}

/* Default keyboard focus (Left/Right toggle it, Enter confirms it — see
   onCardKeydown) — underlines just the label text, not the icon next to
   it, hence the span rather than text-decoration on the whole button. */
.check-opt.is-focused span {
  text-decoration: underline;
}


.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 12px;
}

.tag-row-opt.dimmed {
  opacity: 0.35;
}

.tag-row-empty {
  font-size: 12px;
  color: var(--ink);
  padding: 3px 0;
}

.sub-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px 18px 12px;
}

.sub-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  transition: transform 0.15s ease, opacity 0.2s ease;
}

.sub-item.dragging {
  transition: none;
}

/* Half-mode's final beat for a just-checked sub (see scheduleHalfHide) —
   fades out in place once it's sunk to the bottom, rather than just sitting
   there or popping out of the list with no transition at all. */
.sub-item--leaving {
  opacity: 0;
  transform: translateY(6px);
}

.sub-box {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  margin-top: 2px;
  border: 2px solid var(--ink);
  border-radius: min(var(--radius), 3px);
  box-shadow: 2px 2px 0 var(--sub-shadow);
  background: none;
  padding: 0;
  color: var(--bg);
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
}

.sub-box.checked {
  background: var(--ink);
}

.sub-box--empty {
  cursor: default;
  opacity: 0.35;
  box-shadow: none;
}

.sub-title {
  flex: 1;
  min-width: 0;
  word-break: break-word;
  line-height: 1.3;
  font-size: 0.92em;
  margin-top: 1px;
  cursor: text;
}

.sub-title.done {
  opacity: 0.3;
}

/* Half-mode's "(N done)" note (see completedSubsHintCount) — reuses
   .sub-item's own row layout so its icon lines up roughly where a real
   sub's .sub-box sits, but is deliberately *not* .sub-box itself — no
   border/background/shadow, since this button never represents a sub, just
   a disclosure toggle: click flips it (and doneSubsRevealed) between
   showing and hiding this card's already-done subs, same row and chevron
   either way. Same plain-icon-button pattern as .sub-edit/.sub-delete/
   .sub-grip below (bare glyph, ink↔bg swap on priority cards), not
   .sub-box's boxed one. Font is the todo's own random font (passed in via
   :style), not a fixed one. */
.sub-item--hint {
  /* Center instead of .sub-item's own default flex-start — that's meant
     for a top-aligned checkbox next to a title that can wrap to multiple
     lines; this row is always a single line, so top-aligning the chevron
     against the text read as it floating above/apart from it instead of
     sitting next to it. */
  align-items: center;
  opacity: 0.5;
}

.sub-hint-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 0;
  color: var(--ink);
  cursor: pointer;
  transition: opacity 0.1s;
}

.priority .sub-hint-btn {
  color: var(--bg);
}

@media (hover: hover) {
  .sub-hint-btn:hover {
    opacity: 0.7;
  }
}

.sub-hint-text {
  font-size: 0.92em;
  cursor: pointer;
}

.sub-edit,
.sub-promote,
.sub-delete,
.sub-grip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  margin-top: 2px;
  background: none;
  border: none;
  padding: 0;
  color: var(--ink);
  opacity: 0.45;
  cursor: pointer;
  transition: opacity 0.1s;
}

.sub-grip {
  cursor: grab;
  touch-action: none;
}

.sub-item.dragging .sub-grip {
  cursor: grabbing;
  opacity: 1;
}

@media (hover: hover) {
  .sub-edit:hover,
  .sub-promote:hover,
  .sub-delete:hover,
  .sub-grip:hover {
    opacity: 1;
  }
}

.sub-input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  border-bottom: 1px solid var(--ink);
  outline: none;
  resize: none;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.92em;
  font-family: inherit;
  color: inherit;
  opacity: 0.7;
  padding: 0 0 2px;
  line-height: 1.3;
  margin-top: 1px;
}

.sub-input::placeholder {
  color: var(--ink);
  opacity: 0.55;
}

/* The always-visible add-sub row's underline reads as clutter while it's
   just sitting there unused — only show it once the input actually has
   focus and the person is mid-typing a new sub. */
.sub-input--new {
  border-bottom-color: transparent;
}

.sub-input--new:focus {
  border-bottom-color: var(--ink);
}

.sub-input-wrap {
  flex: 1;
  min-width: 0;
  position: relative;
}

.sub-input-wrap .sub-input {
  width: 100%;
  padding-right: 20px;
}

/* Mirrors .add-input-clear (App.vue's todo-input clear button), scaled
   down to this row's size. */
.sub-input-clear {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--ink);
  border-radius: 50%;
  background: none;
  color: var(--ink);
  opacity: 0.35;
}

@media (hover: hover) {
  .sub-input-clear:hover {
    opacity: 1;
  }
}

@media (max-width: 700px) {
  .todo-card {
    font-size: var(--card-font-size-phone);
  }

  /* Title to icons: a bit more room than between the icons themselves
     (.card-list-actions, 8px), but less than tablet/desktop's
     --icon-title-gap — a phone line is short enough already. */
  .todo-card-main {
    padding: 8px 12px;
    gap: 12px;
  }

  .sub-row {
    padding: 2px 12px 10px;
  }
}

/* Tablet: smaller/finer cards (but keep all action buttons, unlike phone)
   so several fit per row instead of the desktop-sized cards hogging space. */
/* Narrow desktop — a real mouse/keyboard desktop layout (sidebar, 3-column
   grid, keyboard shortcuts all stay on), just not wide enough for
   full-size cards to fit more than one or two per row in Overview's grid
   (AllTodos.vue). Sized halfway between this tablet block below and the
   unqualified desktop default above it. Applies equally to Current, since
   both share this same component/stylesheet — there's no separate
   per-view card size to keep in sync.
   Shrinking the card alone used to have to do all the work (max-width
   down to 360px got uncomfortably cramped) — see the matching
   #app-grid-template-columns override in layout.css's own "Narrow
   desktop" block, which now narrows both side columns in this same
   range and hands the freed-up width to the center column instead. With
   that, the card only needs a lighter trim from the full desktop size. */
@media (min-width: 1025px) and (max-width: 1400px) {
  .todo-card {
    font-size: var(--card-font-size-narrow-desktop);
    max-width: 400px;
  }

  .todo-card-main {
    padding: 8px 13px;
  }

}

@media (min-width: 701px) and (max-width: 1024px) {
  .todo-card {
    font-size: var(--card-font-size-tablet);
    max-width: 100%;
  }

  .todo-card-main {
    padding: 7px 10px;
  }
}
</style>

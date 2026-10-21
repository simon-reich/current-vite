// Arrow keys on a month grid: ←/→ one day, ↑/↓ one week — the one mapping
// every keyboard-navigable calendar shares (Calendar.vue's own grid, the
// focus-date pill's picker modal and tablet panel), so they all move the
// same way. null for any other key.
const ARROW_DAY_DELTAS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
}

export function arrowKeyDayDelta(key: string): number | null {
  return ARROW_DAY_DELTAS[key] ?? null
}

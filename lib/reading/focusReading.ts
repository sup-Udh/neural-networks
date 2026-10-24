/* Pure logic for Focus Reading Mode: the state machine and passage selection. No DOM access in here. */

export type FocusState = "normal" | "entering" | "focused" | "exiting";
export type FocusEvent = "enter" | "settled" | "exit" | "exited";

/**
 * Normal → Entering → Focused → Exiting → Normal.
 * Anything not listed is ignored, so a late timer or a repeated trigger can never produce a contradictory state
 * (for example: re-entering while an exit is still animating).
 */
export function transition(state: FocusState, event: FocusEvent): FocusState {
  switch (state) {
    case "normal":
      return event === "enter" ? "entering" : state;
    case "entering":
      return event === "settled" ? "focused" : event === "exit" ? "exiting" : state;
    case "focused":
      return event === "exit" ? "exiting" : state;
    case "exiting":
      return event === "exited" ? "normal" : state;
  }
}

export const FOCUS_DELAY = { min: 12, max: 15, default: 13 } as const;

export function clampDelaySeconds(value: number): number {
  if (!Number.isFinite(value)) return FOCUS_DELAY.default;
  return Math.min(FOCUS_DELAY.max, Math.max(FOCUS_DELAY.min, Math.round(value)));
}

export interface Candidate {
  top: number;
  bottom: number;
  chars: number;
  inActiveSection: boolean;
}

export interface Usable {
  top: number;
  bottom: number;
}

const MIN_CHARS = 40;
const MIN_VISIBLE = 0.75;

/** Index of the best passage to focus, or null when nothing visible is long enough to read comfortably. */
export function pickPassage(candidates: readonly Candidate[], usable: Usable): number | null {
  const mid = (usable.top + usable.bottom) / 2;
  const half = (usable.bottom - usable.top) / 2;
  let best = -1;
  let bestScore = -Infinity;
  candidates.forEach((c, i) => {
    const height = c.bottom - c.top;
    if (height <= 0 || c.chars < MIN_CHARS) return;
    const visible = Math.min(c.bottom, usable.bottom) - Math.max(c.top, usable.top);
    if (visible / height < MIN_VISIBLE) return;
    const centre = 1 - Math.min(1, Math.abs((c.top + c.bottom) / 2 - mid) / half);
    const length = Math.min(c.chars, 400) / 400;
    const score = (c.inActiveSection ? 30 : 0) + centre * 40 + length * 20 - (c.chars > 900 ? 10 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best < 0 ? null : best;
}

/**
 * Grows a run of consecutive passages around `pick` until it holds enough text to be worth focusing.
 * Returns the inclusive [from, to] indices inside `chars`.
 */
export function growGroup(chars: readonly number[], pick: number, minChars = 260, maxItems = 3): [number, number] {
  let from = pick;
  let to = pick;
  let total = chars[pick] ?? 0;
  while (total < minChars && to - from + 1 < maxItems) {
    if (to + 1 < chars.length) {
      to += 1;
      total += chars[to];
    } else if (from > 0) {
      from -= 1;
      total += chars[from];
    } else {
      break;
    }
  }
  return [from, to];
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

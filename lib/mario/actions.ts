/*
 * Output-to-action mapping and key driving. Kept separate from the network so other mappings can be tried.
 *
 * Network outputs are raw scores (they are NOT probabilities and there is no confidence value).
 * Selection rule: the action with the highest score wins; exact ties go to the earliest entry in ACTIONS
 * (run, then jump, then wait). Any non-finite or missing score makes the decision "wait".
 */

export const ACTIONS = ["run", "jump", "wait"] as const;
export type MarioAction = (typeof ACTIONS)[number];
export const OUTPUT_SIZE = ACTIONS.length;

export function isMarioAction(value: unknown): value is MarioAction {
  return typeof value === "string" && (ACTIONS as readonly string[]).includes(value);
}

export interface Selection {
  action: MarioAction;
  index: number;
  reason: string;
}

export function selectAction(scores: readonly number[]): Selection {
  if (scores.length !== OUTPUT_SIZE || scores.some((s) => !Number.isFinite(s))) {
    return { action: "wait", index: ACTIONS.indexOf("wait"), reason: "Invalid output scores, so the selector chose wait." };
  }
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
  const tied = scores.filter((s) => s === scores[best]).length > 1;
  return {
    action: ACTIONS[best],
    index: best,
    reason: tied
      ? `${ACTIONS[best]} tied for the highest score; ties go to the earlier action in the order ${ACTIONS.join(", ")}.`
      : `${ACTIONS[best]} had the highest output score (${scores[best].toFixed(3)}).`,
  };
}

/** Key names understood by game.js `isKeyDown`. */
export type KeyState = Partial<Record<"LEFT" | "RIGHT" | "RUN" | "JUMP" | "DOWN", boolean>>;

/** Frames JUMP stays held. player.js gives full height while JUMP is held for ~20 frames. */
export const JUMP_HOLD_FRAMES = 20;

/**
 * Turns discrete actions into key states. A jump is a key *edge*: the game only starts a jump when JUMP was
 * released on an earlier frame (`canJump`) and Mario is standing, so after a jump we hold JUMP for
 * JUMP_HOLD_FRAMES, then release it and refuse to press again until Mario has landed and the action is re-chosen.
 */
export class KeyDriver {
  private held = 0;
  private needRelease = false;

  reset() {
    this.held = 0;
    this.needRelease = false;
  }

  next(action: MarioAction, grounded: boolean): KeyState {
    const keys: KeyState = {};
    if (action !== "wait") {
      keys.RIGHT = true;
      keys.RUN = true;
    }
    if (this.held > 0) {
      keys.JUMP = true;
      keys.RIGHT = true;
      this.held -= 1;
      if (this.held === 0) this.needRelease = true;
      return keys;
    }
    if (this.needRelease) {
      // JUMP is released this frame. Allow a new jump only once Mario is grounded again.
      if (grounded) this.needRelease = false;
      return keys;
    }
    if (action === "jump" && grounded) {
      this.held = JUMP_HOLD_FRAMES - 1;
      keys.JUMP = true;
    }
    return keys;
  }
}

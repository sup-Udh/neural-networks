import { forward } from "../nn/network";
import type { ForwardResult, NetworkModel } from "../nn/network";
import { KeyDriver } from "./actions";
import type { KeyState, MarioAction } from "./actions";
import { EpisodeTracker } from "./episode";
import type { EpisodeMetrics } from "./episode";
import { encodeObservation } from "./observation";
import { networkStep } from "./policyStep";
import type { GameSnapshot, Observation } from "./observation";

/** The adapter exposed by public/game/mario/js/game.js as window.__marioHooks. */
export interface MarioHooks {
  paused: boolean;
  keys: KeyState | null;
  beforeUpdate: (() => void) | null;
  frame: number;
  snapshot: () => GameSnapshot;
  reset: () => void;
  /** Advances exactly one frame (fixed dt). Only valid when the animation loop is not running (headless). */
  step: (dt?: number) => void;
}

export type ControlMode = "human" | "network" | "policy";

export interface PolicyRunner {
  /** Sends the latest frame to the policy and returns the most recent completed answer (or null). Never blocks. */
  decide: (input: { observation: Observation & { available: true }; scores: number[] }) => { action: MarioAction | null; error: string | null };
}

export interface Decision {
  frame: number;
  source: "network" | "policy";
  modelRevision: number;
  observation: Observation;
  /** Present only when the network actually ran for this frame. */
  trace: ForwardResult | null;
  action: MarioAction | null;
  explanation: string;
}

export interface ControllerOptions {
  hooks: MarioHooks;
  getModel: () => { model: NetworkModel; revision: number };
  getPolicy?: () => PolicyRunner | null;
  /** `decision` is null in human mode (metrics only). */
  onDecision?: (d: Decision | null, metrics: EpisodeMetrics) => void;
  /** Report a decision to the UI every N frames to keep React out of the 60 Hz loop. */
  reportEvery?: number;
}

/**
 * Owns the game's key input while in "network" or "policy" mode. In "human" mode it sets `hooks.keys = null`
 * so the keyboard is used. Only one source drives the game at any time because `hooks.keys` is a single slot.
 */
export class MarioController {
  private mode: ControlMode = "human";
  private driver = new KeyDriver();
  private tracker = new EpisodeTracker();
  private lastAction: MarioAction = "wait";
  private attached = false;
  private lastReported = -Infinity;

  constructor(private opts: ControllerOptions) {}

  attach() {
    if (this.attached) return;
    this.attached = true;
    this.opts.hooks.beforeUpdate = this.step;
  }

  /** Releases every key and detaches; safe to call repeatedly. */
  detach() {
    if (!this.attached) return;
    this.attached = false;
    this.release();
    if (this.opts.hooks.beforeUpdate === this.step) this.opts.hooks.beforeUpdate = null;
  }

  getMode() {
    return this.mode;
  }

  setMode(mode: ControlMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.release();
  }

  resetEpisode() {
    this.tracker.reset();
    this.release();
  }

  private release() {
    this.driver.reset();
    this.lastAction = "wait";
    this.opts.hooks.keys = null;
  }

  private step = () => {
    const { hooks } = this.opts;
    const snapshot = hooks.snapshot();
    const observation = encodeObservation(snapshot);
    const metrics = this.tracker.observe(snapshot);
    if (this.mode === "human") {
      hooks.keys = null;
      this.report(snapshot.frame, null, metrics);
      return;
    }

    let decision: Decision;
    const { model, revision } = this.opts.getModel();
    if (this.mode === "network") {
      const r = networkStep(model, snapshot, this.driver);
      hooks.keys = r.keys;
      if (r.action) this.lastAction = r.action;
      decision = { frame: snapshot.frame, source: "network", modelRevision: revision, observation: r.observation, trace: r.trace, action: r.action, explanation: r.explanation };
    } else if (!observation.available) {
      this.driver.reset();
      hooks.keys = {};
      decision = { frame: snapshot.frame, source: "policy", modelRevision: revision, observation, trace: null, action: null, explanation: `No decision: ${observation.reason}.` };
    } else {
      let trace: ForwardResult | null = null;
      let action: MarioAction;
      let explanation: string;
      try {
        trace = forward(model, observation.inputs);
        const policy = this.opts.getPolicy?.() ?? null;
        if (!policy) {
          action = "wait";
          explanation = "No policy is active, so the controller waited.";
        } else {
          const answer = policy.decide({ observation, scores: trace.output });
          action = answer.action ?? "wait";
          explanation = answer.error
            ? `Policy error: ${answer.error}. Waiting.`
            : answer.action
              ? `Your policy code returned "${answer.action}".`
              : "The policy has not answered yet, so the controller waited.";
        }
      } catch (error) {
        action = "wait";
        explanation = `Inference failed: ${error instanceof Error ? error.message : String(error)}. Waiting.`;
      }
      this.lastAction = action;
      hooks.keys = this.driver.next(action, observation.raw.isGrounded);
      decision = { frame: snapshot.frame, source: "policy", modelRevision: revision, observation, trace, action, explanation };
    }

    this.report(snapshot.frame, decision, metrics);
  };

  private report(frame: number, decision: Decision | null, metrics: EpisodeMetrics) {
    const every = this.opts.reportEvery ?? 6;
    if (frame - this.lastReported >= every || frame < this.lastReported || metrics.status !== "running") {
      this.lastReported = frame;
      this.opts.onDecision?.(decision, metrics);
    }
  }
}

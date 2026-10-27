import { KeyDriver, selectAction } from "./actions";
import type { MarioAction } from "./actions";
import { forward } from "../nn/network";
import type { MarioHooks } from "./controller";
import { EpisodeTracker } from "./episode";
import type { EpisodeMetrics } from "./episode";
import { networkStep } from "./policyStep";
import type { NetworkStep } from "./policyStep";
import type { NetworkModel } from "../nn/network";
import { encodeObservation } from "./observation";
import type { GameSnapshot, RawObservation } from "./observation";

/*
 * Episode policy (one evaluation = one episode, always from a freshly reset World 1-1):
 *  - "completed"  Mario touched the flagpole (player.flagging) — the only completion signal the game exposes.
 *  - "dead"       player.dying became true (enemy hit while small, or falling below the screen). The evaluation
 *                 STOPS there, so the game's automatic respawn can never extend or inflate an episode.
 *  - "stalled"    no new furthest-x for `stallFrames` frames. Not death: no death penalty is applied.
 *  - "budget"     `maxFrames` simulated frames elapsed. Not death either.
 * Every frame is the game's own update() with a fixed 1/60 s step; there is no second physics implementation.
 */

export const TERMINATIONS = ["completed", "dead", "stalled", "budget"] as const;
export type Termination = (typeof TERMINATIONS)[number];

/** Bump when the fitness formula changes so stored scores from different formulas are never compared blindly. */
export const FITNESS_VERSION = 2;
/** Bump when episode rules (termination, stepping, scenarios) change. */
export const PROTOCOL_VERSION = 2;
export const CANONICAL_SCENARIO_ID = "w1-1-canonical";

export interface FitnessWeights {
  /** Fitness per game pixel of furthest-x progress. */
  progressPerPixel: number;
  /** Added only when the flagpole was actually reached. */
  completionBonus: number;
  /** Subtracted only when death was detected. */
  deathPenalty: number;
  /**
   * Maximum extra reward for finishing fast. Added ONLY when completed, scaled linearly by the unused part of the
   * frame budget: timeBonusMax × (maxFrames − framesUsed) / maxFrames, clamped to [0, timeBonusMax].
   * (v1 of the formula had no time term.)
   */
  timeBonusMax: number;
}

export interface EvaluationConfig {
  maxFrames: number;
  stallFrames: number;
  fitness: FitnessWeights;
  /**
   * Scenario = World 1-1 reset, then this many frames with no input before the controller takes over. The game keeps
   * running (enemies walk toward Mario), so the encounters happen at different moments. Nothing is teleported or edited;
   * it is a controlled variation that uses only the real game loop. 0 is the canonical scenario.
   */
  startDelayFrames: number;
  scenarioId: string;
}

export const DEFAULT_EVAL_CONFIG: EvaluationConfig = {
  maxFrames: 2400,
  stallFrames: 300,
  fitness: { progressPerPixel: 1, completionBonus: 2000, deathPenalty: 100, timeBonusMax: 500 },
  startDelayFrames: 0,
  scenarioId: CANONICAL_SCENARIO_ID,
};

export interface FitnessBreakdown {
  progress: number;
  completionBonus: number;
  deathPenalty: number;
  timeBonus: number;
}

export interface EvaluationResult {
  episodeId: string;
  termination: Termination;
  reason: string;
  /** Raw measurements; kept separate from the fitness derived from them. */
  metrics: EpisodeMetrics;
  fitness: number;
  breakdown: FitnessBreakdown;
  config: EvaluationConfig;
  fitnessVersion: number;
  protocolVersion: number;
}

export function validateEvalConfig(c: EvaluationConfig): string[] {
  const e: string[] = [];
  if (!Number.isInteger(c.maxFrames) || c.maxFrames < 60 || c.maxFrames > 10000) e.push("Frame budget must be a whole number from 60 to 10000.");
  if (!Number.isInteger(c.stallFrames) || c.stallFrames < 30 || c.stallFrames > 10000) e.push("Stall limit must be a whole number from 30 to 10000 (a limit above the frame budget simply never triggers).");
  const f = c.fitness;
  if (!(Number.isFinite(f.progressPerPixel) && f.progressPerPixel > 0)) e.push("Progress weight must be a positive number.");
  if (!(Number.isFinite(f.completionBonus) && f.completionBonus >= 0)) e.push("Completion bonus must be 0 or more.");
  if (!(Number.isFinite(f.deathPenalty) && f.deathPenalty >= 0)) e.push("Death penalty must be 0 or more.");
  if (!(Number.isFinite(f.timeBonusMax) && f.timeBonusMax >= 0 && f.timeBonusMax <= 5000)) e.push("Time bonus must be between 0 and 5000.");
  if (!Number.isInteger(c.startDelayFrames) || c.startDelayFrames < 0 || c.startDelayFrames > 300) e.push("Start delay must be a whole number from 0 to 300 frames.");
  return e;
}

/**
 * fitness = progressPerPixel·distance
 *         + (completed ? completionBonus : 0)
 *         + (completed ? timeBonus : 0)        timeBonus = timeBonusMax·clamp((maxFrames − frames)/maxFrames, 0, 1)
 *         − (dead ? deathPenalty : 0)
 * `frames`/`maxFrames` are simulated frames of the episode. Without them (older callers) the time bonus is 0.
 */
export function computeFitness(
  distance: number,
  termination: Termination,
  w: FitnessWeights,
  frames?: number,
  maxFrames?: number,
): { fitness: number; breakdown: FitnessBreakdown } {
  let timeBonus = 0;
  if (termination === "completed" && frames !== undefined && maxFrames !== undefined && Number.isFinite(frames) && maxFrames > 0 && w.timeBonusMax > 0) {
    timeBonus = w.timeBonusMax * Math.max(0, Math.min(1, (maxFrames - frames) / maxFrames));
  }
  const breakdown: FitnessBreakdown = {
    progress: w.progressPerPixel * Math.max(0, distance),
    completionBonus: termination === "completed" ? w.completionBonus : 0,
    deathPenalty: termination === "dead" ? w.deathPenalty : 0,
    timeBonus,
  };
  return { fitness: breakdown.progress + breakdown.completionBonus + breakdown.timeBonus - breakdown.deathPenalty, breakdown };
}

export interface FrameProbe {
  frame: number;
  snapshot: GameSnapshot;
  step: NetworkStep;
}

/** An evaluator may be backed by a worker or run in-process; callers only see this interface. */
export interface Evaluator {
  evaluate(model: NetworkModel, config: EvaluationConfig, episodeId: string): Promise<EvaluationResult>;
  dispose(): void;
}

/** Runs episodes synchronously against a booted game's hooks. Holds no state between episodes. */
export class HeadlessEvaluator {
  constructor(private hooks: MarioHooks) {}

  /** `probe` may return `true` to stop the episode early (used for scene capture; the episode then ends as "budget"). */
  evaluateSync(model: NetworkModel, config: EvaluationConfig, episodeId: string, probe?: (p: FrameProbe) => boolean | void): EvaluationResult {
    const errors = validateEvalConfig(config);
    if (errors.length) throw new Error(errors.join(" "));
    const { hooks } = this;
    // Clean episode: new level and player, no held keys, fresh key driver and tracker, nothing carried over.
    hooks.paused = false;
    hooks.beforeUpdate = null;
    hooks.reset();
    hooks.keys = {};
    // Scenario start delay: real game frames with no input (see EvaluationConfig.startDelayFrames).
    for (let d = 0; d < config.startDelayFrames; d++) hooks.step();
    const driver = new KeyDriver();
    const tracker = new EpisodeTracker();

    let metrics: EpisodeMetrics | null = null;
    let bestX = -Infinity;
    let lastGain = 0;
    let termination: Termination = "budget";
    let reason = `Frame budget of ${config.maxFrames} reached.`;

    for (let i = 0; ; i++) {
      const snap = hooks.snapshot();
      metrics = tracker.observe(snap);
      if (metrics.status === "completed") {
        termination = "completed";
        reason = "Mario reached the flagpole.";
        break;
      }
      if (metrics.status === "dead") {
        termination = "dead";
        reason = "Mario died (enemy contact or a fall).";
        break;
      }
      if (snap.player.x > bestX + 1) {
        bestX = snap.player.x;
        lastGain = i;
      }
      if (i >= config.maxFrames) break;
      if (i - lastGain >= config.stallFrames) {
        termination = "stalled";
        reason = `No new progress for ${config.stallFrames} frames.`;
        break;
      }
      const step = networkStep(model, snap, driver);
      if (probe?.({ frame: i, snapshot: snap, step }) === true) {
        reason = "Stopped by the caller (scene capture).";
        break;
      }
      hooks.keys = step.keys;
      hooks.step();
    }
    hooks.keys = null;
    const { fitness, breakdown } = computeFitness(metrics.distance, termination, config.fitness, metrics.frames, config.maxFrames);
    return { episodeId, termination, reason, metrics, fitness, breakdown, config, fitnessVersion: FITNESS_VERSION, protocolVersion: PROTOCOL_VERSION };
  }
}

/** A real game moment, observed two ways, with the real forward pass for each (see captureScene). */
export interface SceneCapture {
  frame: number;
  x: number;
  raw: RawObservation;
  /** Current encoding: warp pipes count as obstacles. */
  current: { inputs: number[]; outputs: number[]; action: MarioAction };
  /** Pipe-blind encoding (tiles only), as the original v1 encoder behaved. Same game state, same model. */
  pipeBlind: { inputs: number[]; outputs: number[]; action: MarioAction };
}

/** Anything that can capture a scene (the worker client and the in-process evaluator both can). */
export interface SceneProber {
  captureScene(model: NetworkModel, config: EvaluationConfig, targetX: number): Promise<SceneCapture | null>;
}

/**
 * Plays the model in the real game from the canonical start until Mario's x reaches `targetX` (or the episode ends,
 * returning null), then reports what the network saw and chose at that exact moment. Nothing is staged or teleported.
 */
export function captureSceneSync(evaluator: HeadlessEvaluator, model: NetworkModel, config: EvaluationConfig, targetX: number): SceneCapture | null {
  let scene: SceneCapture | null = null;
  evaluator.evaluateSync(model, config, "scene", (p) => {
    if (p.snapshot.player.x < targetX || !p.step.observation.available || !p.step.trace) return;
    const blind = encodeObservation({ ...p.snapshot, isSolid: p.snapshot.isSolidTile ?? p.snapshot.isSolid });
    if (!blind.available) return;
    const blindOut = forward(model, blind.inputs).output;
    scene = {
      frame: p.frame,
      x: p.snapshot.player.x,
      raw: p.step.observation.raw,
      current: { inputs: p.step.observation.inputs, outputs: p.step.trace.output, action: selectAction(p.step.trace.output).action },
      pipeBlind: { inputs: blind.inputs, outputs: blindOut, action: selectAction(blindOut).action },
    };
    return true;
  });
  return scene;
}

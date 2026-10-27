import { KeyDriver } from "./actions";
import type { MarioHooks } from "./controller";
import { EpisodeTracker } from "./episode";
import type { EpisodeMetrics } from "./episode";
import { networkStep } from "./policyStep";
import type { NetworkStep } from "./policyStep";
import type { NetworkModel } from "../nn/network";
import type { GameSnapshot } from "./observation";

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

export interface FitnessWeights {
  /** Fitness per game pixel of furthest-x progress. */
  progressPerPixel: number;
  /** Added only when the flagpole was actually reached. */
  completionBonus: number;
  /** Subtracted only when death was detected. */
  deathPenalty: number;
}

export interface EvaluationConfig {
  maxFrames: number;
  stallFrames: number;
  fitness: FitnessWeights;
}

export const DEFAULT_EVAL_CONFIG: EvaluationConfig = {
  maxFrames: 2400,
  stallFrames: 300,
  fitness: { progressPerPixel: 1, completionBonus: 2000, deathPenalty: 100 },
};

export interface FitnessBreakdown {
  progress: number;
  completionBonus: number;
  deathPenalty: number;
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
}

export function validateEvalConfig(c: EvaluationConfig): string[] {
  const e: string[] = [];
  if (!Number.isInteger(c.maxFrames) || c.maxFrames < 60 || c.maxFrames > 10000) e.push("Frame budget must be a whole number from 60 to 10000.");
  if (!Number.isInteger(c.stallFrames) || c.stallFrames < 30 || c.stallFrames > 10000) e.push("Stall limit must be a whole number from 30 to 10000 (a limit above the frame budget simply never triggers).");
  const f = c.fitness;
  if (!(Number.isFinite(f.progressPerPixel) && f.progressPerPixel > 0)) e.push("Progress weight must be a positive number.");
  if (!(Number.isFinite(f.completionBonus) && f.completionBonus >= 0)) e.push("Completion bonus must be 0 or more.");
  if (!(Number.isFinite(f.deathPenalty) && f.deathPenalty >= 0)) e.push("Death penalty must be 0 or more.");
  return e;
}

/** fitness = progressPerPixel·distance + (completed ? completionBonus : 0) − (dead ? deathPenalty : 0) */
export function computeFitness(distance: number, termination: Termination, w: FitnessWeights): { fitness: number; breakdown: FitnessBreakdown } {
  const breakdown: FitnessBreakdown = {
    progress: w.progressPerPixel * Math.max(0, distance),
    completionBonus: termination === "completed" ? w.completionBonus : 0,
    deathPenalty: termination === "dead" ? w.deathPenalty : 0,
  };
  return { fitness: breakdown.progress + breakdown.completionBonus - breakdown.deathPenalty, breakdown };
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

  evaluateSync(model: NetworkModel, config: EvaluationConfig, episodeId: string, probe?: (p: FrameProbe) => void): EvaluationResult {
    const errors = validateEvalConfig(config);
    if (errors.length) throw new Error(errors.join(" "));
    const { hooks } = this;
    // Clean episode: new level and player, no held keys, fresh key driver and tracker, nothing carried over.
    hooks.paused = false;
    hooks.beforeUpdate = null;
    hooks.reset();
    hooks.keys = {};
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
      probe?.({ frame: i, snapshot: snap, step });
      hooks.keys = step.keys;
      hooks.step();
    }
    hooks.keys = null;
    const { fitness, breakdown } = computeFitness(metrics.distance, termination, config.fitness);
    return { episodeId, termination, reason, metrics, fitness, breakdown, config };
  }
}

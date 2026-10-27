import { cloneModel } from "../nn/network";
import type { NetworkModel } from "../nn/network";
import { FITNESS_VERSION, PROTOCOL_VERSION } from "./evaluation";
import type { Evaluator, EvaluationResult, Termination } from "./evaluation";
import { initPopulation, makeRng, nextPopulation, rankCandidates, validateTrainingConfig } from "./evolution";
import type { EvaluatedCandidate, Origin, TrainingConfig } from "./evolution";

/*
 * Trainer state machine:
 *   idle → initializing → evaluating ⇄ evolving → completed
 *                    any state → cancelled (user stop) | error
 * There is deliberately no pause: a half-evaluated generation cannot be resumed meaningfully, so only Stop exists.
 */

export type TrainerState = "idle" | "initializing" | "evaluating" | "evolving" | "completed" | "cancelled" | "error";

/** Compact, serialisable record of one candidate's measured outcome (no model). */
export interface CandidateSummary {
  id: string;
  parentId: string | null;
  origin: Origin;
  fitness: number | null;
  termination: Termination | null;
  distance: number | null;
  error: string | null;
}

/** Measured outcome of one development episode. */
export interface CandidateOutcome {
  fitness: number;
  termination: Termination;
  distance: number;
  progress: number;
  frames: number;
}

/** Bump when the stored session shape changes. Sessions saved before versioning have no schemaVersion (treated as 1). */
export const SESSION_SCHEMA_VERSION = 2;

export interface BestRecord {
  candidateId: string;
  generation: number;
  /** "start" = the unmodified start model, "elite" = copied unchanged, "mutant" = mutated copy. May be absent in sessions saved before provenance tracking. */
  origin?: Origin;
  parentId: string | null;
  fitness: number;
  termination: Termination;
  distance: number;
  progress: number;
  frames: number;
  /** Deep copy, isolated from every later mutation. */
  model: NetworkModel;
}

export interface GenerationSummary {
  index: number;
  best: BestRecord | null;
  avgFitness: number | null;
  worstFitness: number | null;
  /** Fraction of valid candidates that reached the flagpole. */
  completionRate: number;
  evaluated: number;
  failed: number;
  terminations: Record<Termination, number>;
  candidates: CandidateSummary[];
}

export interface TrainingSession {
  /** Absent on sessions saved before schema versioning (those lack baseline/provenance fields and use fitness v1). */
  schemaVersion?: number;
  fitnessVersion?: number;
  protocolVersion?: number;
  /** Development outcome of the unmodified start model under the same protocol as every candidate (null until measured). */
  baseline?: CandidateOutcome | null;
  id: string;
  createdAt: number;
  finishedAt: number | null;
  state: TrainerState;
  config: TrainingConfig;
  startLabel: string;
  startModel: NetworkModel;
  generations: GenerationSummary[];
  globalBest: BestRecord | null;
  /** Generation currently being evaluated (0-based) and how many of its candidates are done. */
  currentGeneration: number;
  currentCandidate: number;
  candidatesEvaluated: number;
  failures: number;
  error: string | null;
}

const emptyTerminations = (): Record<Termination, number> => ({ completed: 0, dead: 0, stalled: 0, budget: 0 });

function toBest(c: EvaluatedCandidate, r: EvaluationResult): BestRecord {
  return {
    candidateId: c.id, generation: c.generation, origin: c.origin, parentId: c.parentId, fitness: r.fitness, termination: r.termination,
    distance: r.metrics.distance, progress: r.metrics.progress, frames: r.metrics.frames, model: cloneModel(c.model),
  };
}

export function summarizeGeneration(index: number, ranked: readonly EvaluatedCandidate[]): GenerationSummary {
  const valid = ranked.filter((c) => c.result);
  const fits = valid.map((c) => c.result!.fitness);
  const terminations = emptyTerminations();
  valid.forEach((c) => terminations[c.result!.termination]++);
  return {
    index,
    best: valid.length ? toBest(valid[0], valid[0].result!) : null,
    avgFitness: fits.length ? fits.reduce((a, b) => a + b, 0) / fits.length : null,
    worstFitness: fits.length ? Math.min(...fits) : null,
    completionRate: valid.length ? terminations.completed / valid.length : 0,
    evaluated: valid.length,
    failed: ranked.length - valid.length,
    terminations,
    candidates: ranked.map((c) => ({
      id: c.id, parentId: c.parentId, origin: c.origin, fitness: c.result?.fitness ?? null, termination: c.result?.termination ?? null,
      distance: c.result?.metrics.distance ?? null, error: c.error,
    })),
  };
}

export class Trainer {
  private session: TrainingSession;
  private cancelled = false;
  private running = false;

  constructor(
    private evaluator: Evaluator,
    config: TrainingConfig,
    startModel: NetworkModel,
    startLabel: string,
    private onUpdate: (s: TrainingSession) => void,
    private now: () => number = Date.now,
  ) {
    this.session = {
      schemaVersion: SESSION_SCHEMA_VERSION, fitnessVersion: FITNESS_VERSION, protocolVersion: PROTOCOL_VERSION, baseline: null,
      id: `train-${this.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      createdAt: this.now(), finishedAt: null, state: "idle", config: structuredClone(config), startLabel,
      startModel: cloneModel(startModel), generations: [], globalBest: null, currentGeneration: 0, currentCandidate: 0,
      candidatesEvaluated: 0, failures: 0, error: null,
    };
  }

  getSession(): TrainingSession {
    return this.session;
  }

  /** Requests a stop. Takes effect before the next candidate; the caller should also dispose the evaluator. */
  cancel() {
    this.cancelled = true;
  }

  private set(patch: Partial<TrainingSession>) {
    this.session = { ...this.session, ...patch };
    this.onUpdate(this.session);
  }

  async run(): Promise<TrainingSession> {
    if (this.running) throw new Error("This trainer is already running.");
    this.running = true;
    const cfg = this.session.config;
    try {
      this.set({ state: "initializing" });
      const problems = validateTrainingConfig(cfg);
      if (problems.length) throw new Error(problems.join(" "));
      const rng = makeRng(cfg.seed);
      let population = initPopulation(this.session.startModel, cfg, rng);

      for (let g = 0; g < cfg.generations; g++) {
        this.set({ state: "evaluating", currentGeneration: g, currentCandidate: 0 });
        const evaluated: EvaluatedCandidate[] = [];
        for (const cand of population) {
          if (this.cancelled) return this.finish("cancelled");
          this.set({ currentCandidate: cand.index });
          let result: EvaluationResult | null = null;
          let error: string | null = null;
          try {
            result = await this.evaluator.evaluate(cand.model, cfg.eval, `${this.session.id}:${cand.id}`);
          } catch (e) {
            if (this.cancelled) return this.finish("cancelled");
            error = e instanceof Error ? e.message : String(e);
          }
          evaluated.push({ ...cand, result, error });
          this.session = { ...this.session, candidatesEvaluated: this.session.candidatesEvaluated + (result ? 1 : 0), failures: this.session.failures + (result ? 0 : 1) };
        }
        if (this.cancelled) return this.finish("cancelled");

        const ranked = rankCandidates(evaluated);
        const summary = summarizeGeneration(g, ranked);
        let globalBest = this.session.globalBest;
        if (summary.best && (!globalBest || summary.best.fitness > globalBest.fitness)) globalBest = { ...summary.best, model: cloneModel(summary.best.model) };
        let baseline = this.session.baseline ?? null;
        if (g === 0) {
          // Candidate g0-c0 is the unmodified start model, so this is the baseline under the identical protocol.
          const c0 = evaluated.find((c) => c.id === "g0-c0")?.result;
          if (c0) baseline = { fitness: c0.fitness, termination: c0.termination, distance: c0.metrics.distance, progress: c0.metrics.progress, frames: c0.metrics.frames };
        }
        this.set({ state: "evolving", generations: [...this.session.generations, summary], globalBest, baseline });
        if (!summary.best) throw new Error(`Generation ${g + 1}: every candidate failed to evaluate (${ranked[0]?.error ?? "unknown error"}).`);
        if (g < cfg.generations - 1) population = nextPopulation(ranked, g + 1, cfg, rng);
      }
      return this.finish("completed");
    } catch (e) {
      return this.finish("error", e instanceof Error ? e.message : String(e));
    } finally {
      this.running = false;
    }
  }

  private finish(state: "completed" | "cancelled" | "error", error: string | null = null): TrainingSession {
    this.set({ state, error, finishedAt: this.now() });
    return this.session;
  }
}

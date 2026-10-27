import { cloneModel, seededRandom, validateModel } from "../nn/network";
import type { NetworkModel } from "../nn/network";
import { DEFAULT_EVAL_CONFIG, validateEvalConfig } from "./evaluation";
import type { EvaluationConfig, EvaluationResult } from "./evaluation";

/*
 * Neuroevolution (a simple generational GA, no crossover):
 *  1. Generation 0 = the start model unchanged (candidate 0, so the baseline is always measured) plus
 *     `populationSize - 1` mutated copies of it.
 *  2. Every candidate is evaluated in a fresh real-game episode.
 *  3. Rank by measured fitness (ties: lower candidate index first; failed evaluations rank last and never breed).
 *  4. The top `eliteCount` pass to the next generation unchanged. Every other slot is a mutated copy of a parent
 *     chosen by tournament selection among the top half of valid candidates.
 * Trade-offs: elitism means the best fitness in the population never drops (the game is deterministic, so a
 * re-evaluated elite scores the same); mutation-only search is simple and keeps architecture fixed but can stall in
 * local optima, and nothing guarantees improvement in any given generation.
 */

export const MAX_PARAM_ABS = 10;

export interface TrainingConfig {
  populationSize: number;
  generations: number;
  /** Probability that any single weight or bias is perturbed. */
  mutationRate: number;
  /** Standard deviation of the Gaussian perturbation. */
  mutationStrength: number;
  eliteCount: number;
  /** Seeds the evolutionary random choices (mutation, parent selection). The game itself is deterministic anyway. */
  seed: number;
  tournamentSize: number;
  eval: EvaluationConfig;
}

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  populationSize: 16,
  generations: 12,
  mutationRate: 0.3,
  mutationStrength: 0.4,
  eliteCount: 2,
  seed: 1,
  tournamentSize: 3,
  eval: DEFAULT_EVAL_CONFIG,
};

/** Upper bound on total simulated frames per session (population × generations × frame budget). */
export const MAX_TOTAL_FRAMES = 6_000_000;

export function validateTrainingConfig(c: TrainingConfig): string[] {
  const e: string[] = [];
  const int = (v: number) => Number.isInteger(v);
  if (!int(c.populationSize) || c.populationSize < 4 || c.populationSize > 64) e.push("Population size must be a whole number from 4 to 64.");
  if (!int(c.generations) || c.generations < 1 || c.generations > 100) e.push("Generations must be a whole number from 1 to 100.");
  if (!(Number.isFinite(c.mutationRate) && c.mutationRate > 0 && c.mutationRate <= 1)) e.push("Mutation rate must be greater than 0 and at most 1.");
  if (!(Number.isFinite(c.mutationStrength) && c.mutationStrength > 0 && c.mutationStrength <= 2)) e.push("Mutation strength must be greater than 0 and at most 2.");
  if (!int(c.eliteCount) || c.eliteCount < 1 || c.eliteCount > Math.floor(c.populationSize / 2)) e.push("Elite count must be a whole number from 1 to half the population.");
  if (!int(c.seed)) e.push("Seed must be a whole number.");
  if (!int(c.tournamentSize) || c.tournamentSize < 1 || c.tournamentSize > 8) e.push("Tournament size must be a whole number from 1 to 8.");
  e.push(...validateEvalConfig(c.eval));
  if (int(c.populationSize) && int(c.generations) && int(c.eval.maxFrames) && c.populationSize * c.generations * c.eval.maxFrames > MAX_TOTAL_FRAMES) {
    e.push(`This run could simulate more than ${MAX_TOTAL_FRAMES.toLocaleString()} frames (population × generations × frame budget). Lower one of them.`);
  }
  return e;
}

export type Rng = () => number;
export const makeRng = (seed: number): Rng => seededRandom(seed);

/** Standard normal sample (Box–Muller). */
export function gaussian(rng: Rng): number {
  const u = Math.max(rng(), Number.MIN_VALUE);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

const clampParam = (v: number) => Math.max(-MAX_PARAM_ABS, Math.min(MAX_PARAM_ABS, v));

/** Returns a NEW model; the argument is never modified. Architecture and activations are preserved. */
export function mutateModel(model: NetworkModel, rate: number, strength: number, rng: Rng): NetworkModel {
  const child = cloneModel(model);
  const perturb = (v: number) => (rng() < rate ? clampParam(v + gaussian(rng) * strength) : v);
  for (const layer of child.layers) {
    layer.weights = layer.weights.map((row) => row.map(perturb));
    layer.biases = layer.biases.map(perturb);
  }
  const problems = validateModel(child);
  if (problems.length) throw new Error(`Mutation produced an invalid model: ${problems.join(" ")}`);
  return child;
}

export type Origin = "start" | "elite" | "mutant";

export interface Candidate {
  id: string;
  generation: number;
  index: number;
  parentId: string | null;
  origin: Origin;
  model: NetworkModel;
}

export interface EvaluatedCandidate extends Candidate {
  /** null when the evaluation failed; no fitness is invented for failures. */
  result: EvaluationResult | null;
  error: string | null;
}

export const candidateId = (generation: number, index: number) => `g${generation}-c${index}`;

export function initPopulation(start: NetworkModel, cfg: TrainingConfig, rng: Rng): Candidate[] {
  const pop: Candidate[] = [{ id: candidateId(0, 0), generation: 0, index: 0, parentId: null, origin: "start", model: cloneModel(start) }];
  for (let i = 1; i < cfg.populationSize; i++) {
    pop.push({ id: candidateId(0, i), generation: 0, index: i, parentId: pop[0].id, origin: "mutant", model: mutateModel(start, cfg.mutationRate, cfg.mutationStrength, rng) });
  }
  return pop;
}

/** Best first. Failed evaluations last; ties by candidate index so ordering is deterministic. */
export function rankCandidates<T extends EvaluatedCandidate>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    const fa = a.result?.fitness;
    const fb = b.result?.fitness;
    if (fa === undefined && fb === undefined) return a.index - b.index;
    if (fa === undefined) return 1;
    if (fb === undefined) return -1;
    return fb - fa || a.index - b.index;
  });
}

function tournament(pool: readonly EvaluatedCandidate[], size: number, rng: Rng): EvaluatedCandidate {
  let best = pool[Math.floor(rng() * pool.length)];
  for (let i = 1; i < size; i++) {
    const c = pool[Math.floor(rng() * pool.length)];
    // pool is ranked best-first, so a lower array index is fitter
    if (pool.indexOf(c) < pool.indexOf(best)) best = c;
  }
  return best;
}

/** Builds generation `generation` from the ranked, evaluated previous one. */
export function nextPopulation(ranked: readonly EvaluatedCandidate[], generation: number, cfg: TrainingConfig, rng: Rng): Candidate[] {
  const valid = ranked.filter((c) => c.result !== null);
  if (valid.length === 0) throw new Error("Every candidate failed to evaluate, so there is nothing to breed from.");
  const next: Candidate[] = [];
  const elites = valid.slice(0, Math.min(cfg.eliteCount, valid.length));
  elites.forEach((c, i) => next.push({ id: candidateId(generation, i), generation, index: i, parentId: c.id, origin: "elite", model: cloneModel(c.model) }));
  const pool = valid.slice(0, Math.max(1, Math.ceil(valid.length / 2)));
  while (next.length < cfg.populationSize) {
    const parent = tournament(pool, cfg.tournamentSize, rng);
    const index = next.length;
    next.push({ id: candidateId(generation, index), generation, index, parentId: parent.id, origin: "mutant", model: mutateModel(parent.model, cfg.mutationRate, cfg.mutationStrength, rng) });
  }
  return next;
}

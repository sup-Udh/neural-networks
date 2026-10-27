import type { NetworkModel } from "../nn/network";
import { modelHash } from "../nn/compare";
import { CANONICAL_SCENARIO_ID, FITNESS_VERSION, PROTOCOL_VERSION } from "./evaluation";
import type { EvaluationConfig, Evaluator } from "./evaluation";
import { summarize, toEpisodeRecord } from "./summary";
import type { EpisodeRecord, EvalSummary } from "./summary";

/*
 * Evaluation roles
 *  development  The canonical scenario only (World 1-1, no start delay). The ONLY thing evolution ever sees.
 *  validation   Held-out start timings. Never used to pick parents or mutate anything; run after training.
 *  matched      canonical + held-out. Used to compare two or more models under an identical protocol.
 * "Held-out" means held out from evolution, not unseen levels: the game has one level, so this measures robustness
 * to when enemies arrive, not generalisation to new levels.
 */
export type EvalRole = "development" | "validation" | "matched";

/** Start delays (frames of no input before the controller takes over) that evolution never trains on. */
export const HELD_OUT_DELAYS = [11, 29, 47, 73, 97] as const;

export const scenarioIdForDelay = (delay: number) => (delay === 0 ? CANONICAL_SCENARIO_ID : `w1-1-delay-${delay}`);

/** The exact list of episode configurations for a role, derived from one base config so budgets stay identical. */
export function scenariosFor(role: EvalRole, base: EvaluationConfig): EvaluationConfig[] {
  const at = (delay: number): EvaluationConfig => ({ ...base, startDelayFrames: delay, scenarioId: scenarioIdForDelay(delay) });
  if (role === "development") return [at(0)];
  if (role === "validation") return HELD_OUT_DELAYS.map(at);
  return [at(0), ...HELD_OUT_DELAYS.map(at)];
}

export interface EvaluationRecord {
  id: string;
  createdAt: number;
  role: EvalRole;
  label: string;
  /** Content hash of the evaluated model; the model itself is stored elsewhere (snapshot, session, workspace). */
  modelHash: string;
  scenarioIds: string[];
  protocolVersion: number;
  fitnessVersion: number;
  episodes: EpisodeRecord[];
  summary: EvalSummary;
  /** Why it was run, e.g. a training session id or a challenge id. */
  context: string | null;
}

export interface BatchJob {
  label: string;
  model: NetworkModel;
  role: EvalRole;
  context?: string | null;
}

export async function evaluateJob(
  evaluator: Evaluator,
  job: BatchJob,
  base: EvaluationConfig,
  idPrefix: string,
  shouldStop: () => boolean = () => false,
  now: () => number = Date.now,
): Promise<EvaluationRecord> {
  const scenarios = scenariosFor(job.role, base);
  const episodes: EpisodeRecord[] = [];
  for (let i = 0; i < scenarios.length; i++) {
    if (shouldStop()) throw new Error("Evaluation was stopped.");
    episodes.push(toEpisodeRecord(await evaluator.evaluate(job.model, scenarios[i], `${idPrefix}:${scenarios[i].scenarioId}`)));
  }
  return {
    id: `${idPrefix}-${modelHash(job.model)}`,
    createdAt: now(),
    role: job.role,
    label: job.label,
    modelHash: modelHash(job.model),
    scenarioIds: scenarios.map((s) => s.scenarioId),
    protocolVersion: PROTOCOL_VERSION,
    fitnessVersion: FITNESS_VERSION,
    episodes,
    summary: summarize(episodes),
    context: job.context ?? null,
  };
}

/** Latest record for a model under a given role and the current protocol/fitness versions, or null. */
export function findEvaluation(records: readonly EvaluationRecord[], hash: string, role: EvalRole): EvaluationRecord | null {
  return records.find((r) => r.modelHash === hash && r.role === role && r.protocolVersion === PROTOCOL_VERSION && r.fitnessVersion === FITNESS_VERSION) ?? null;
}

import { FITNESS_VERSION, PROTOCOL_VERSION } from "./evaluation";
import type { EvaluationResult, Termination } from "./evaluation";

/** Compact per-episode record (no model, no raw trace) so many can be stored. */
export interface EpisodeRecord {
  scenarioId: string;
  startDelayFrames: number;
  termination: Termination;
  distance: number;
  /** 0..1 fraction of the way to the flagpole. */
  progress: number;
  frames: number;
  fitness: number;
}

export function toEpisodeRecord(r: EvaluationResult): EpisodeRecord {
  return {
    scenarioId: r.config.scenarioId, startDelayFrames: r.config.startDelayFrames, termination: r.termination,
    distance: r.metrics.distance, progress: r.metrics.progress, frames: r.metrics.frames, fitness: r.fitness,
  };
}

export interface EvalSummary {
  episodes: number;
  /** Number of different scenarios among the episodes (episodes in the same scenario repeat the same deterministic run). */
  distinctScenarios: number;
  completions: number;
  completionRate: number;
  avgProgress: number | null;
  bestProgress: number | null;
  worstProgress: number | null;
  avgDistance: number | null;
  /** Averaged over SUCCESSFUL episodes only; `completionSamples` is the denominator. */
  avgCompletionFrames: number | null;
  fastestCompletionFrames: number | null;
  completionSamples: number;
  deaths: number;
  stalls: number;
  budgets: number;
  fitnessMean: number | null;
  fitnessMin: number | null;
  fitnessMax: number | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Missing data stays null (never silently 0): an empty list gives nulls, not zeros. */
export function summarize(records: readonly EpisodeRecord[]): EvalSummary {
  const done = records.filter((r) => r.termination === "completed");
  const progress = records.map((r) => r.progress);
  const fit = records.map((r) => r.fitness);
  const count = (t: Termination) => records.filter((r) => r.termination === t).length;
  return {
    episodes: records.length,
    distinctScenarios: new Set(records.map((r) => r.scenarioId)).size,
    completions: done.length,
    completionRate: records.length ? done.length / records.length : 0,
    avgProgress: mean(progress),
    bestProgress: progress.length ? Math.max(...progress) : null,
    worstProgress: progress.length ? Math.min(...progress) : null,
    avgDistance: mean(records.map((r) => r.distance)),
    avgCompletionFrames: mean(done.map((r) => r.frames)),
    fastestCompletionFrames: done.length ? Math.min(...done.map((r) => r.frames)) : null,
    completionSamples: done.length,
    deaths: count("dead"),
    stalls: count("stalled"),
    budgets: count("budget"),
    fitnessMean: mean(fit),
    fitnessMin: fit.length ? Math.min(...fit) : null,
    fitnessMax: fit.length ? Math.max(...fit) : null,
  };
}

export type Verdict = "improved" | "regressed" | "equivalent" | "inconclusive";

export interface Comparison {
  verdict: Verdict;
  reasons: string[];
}

/** Honest scope of every verdict. */
export const VERDICT_NOTE =
  "Verdicts compare measured outcomes on this exact set of start timings. They are not statistical significance tests: the game is deterministic, so repeating the same scenario just repeats the same run.";

export const MIN_EPISODES_FOR_VERDICT = 3;

/**
 * Hierarchy: 1) completion rate  2) among equal completion rates, faster average completion (needs completions in both)
 * 3) otherwise average progress. Requires matched protocols (same scenarios and counts) and enough episodes.
 */
export function compareSummaries(
  base: { summary: EvalSummary; scenarioIds: string[]; protocolVersion: number; fitnessVersion: number },
  other: { summary: EvalSummary; scenarioIds: string[]; protocolVersion: number; fitnessVersion: number },
): Comparison {
  const a = base.summary;
  const b = other.summary;
  if (base.protocolVersion !== other.protocolVersion) return { verdict: "inconclusive", reasons: ["Different evaluation protocol versions; results are not comparable."] };
  const sa = [...base.scenarioIds].sort().join(",");
  const sb = [...other.scenarioIds].sort().join(",");
  if (sa !== sb) return { verdict: "inconclusive", reasons: ["The two models were not evaluated on the same scenarios."] };
  if (a.episodes < MIN_EPISODES_FOR_VERDICT) return { verdict: "inconclusive", reasons: [`Only ${a.episodes} episode(s); at least ${MIN_EPISODES_FOR_VERDICT} are needed for a verdict.`] };
  if (a.distinctScenarios < 2) return { verdict: "inconclusive", reasons: ["All episodes are the same deterministic scenario, so this measures repeatability, not robustness."] };

  const reasons: string[] = [];
  const dRate = b.completionRate - a.completionRate;
  if (Math.abs(dRate) >= 1 / a.episodes - 1e-9) {
    reasons.push(`Completion rate ${(a.completionRate * 100).toFixed(0)}% → ${(b.completionRate * 100).toFixed(0)}% (${b.completions}/${b.episodes} vs ${a.completions}/${a.episodes}).`);
    return { verdict: dRate > 0 ? "improved" : "regressed", reasons };
  }
  reasons.push(`Same completion rate (${(a.completionRate * 100).toFixed(0)}%).`);
  if (a.avgCompletionFrames !== null && b.avgCompletionFrames !== null) {
    const rel = (b.avgCompletionFrames - a.avgCompletionFrames) / a.avgCompletionFrames;
    if (Math.abs(rel) >= 0.02) {
      reasons.push(`Average completion time ${Math.round(a.avgCompletionFrames)} → ${Math.round(b.avgCompletionFrames)} frames (over ${a.completionSamples} and ${b.completionSamples} successful episodes).`);
      return { verdict: rel < 0 ? "improved" : "regressed", reasons };
    }
    reasons.push("Completion times differ by less than 2%.");
  }
  if (a.avgProgress !== null && b.avgProgress !== null) {
    const dp = b.avgProgress - a.avgProgress;
    if (Math.abs(dp) >= 0.02) {
      reasons.push(`Average progress ${(a.avgProgress * 100).toFixed(0)}% → ${(b.avgProgress * 100).toFixed(0)}%.`);
      return { verdict: dp > 0 ? "improved" : "regressed", reasons };
    }
    reasons.push("Average progress differs by less than 2 percentage points.");
  }
  return { verdict: "equivalent", reasons };
}

export const protocolVersions = { fitnessVersion: FITNESS_VERSION, protocolVersion: PROTOCOL_VERSION };

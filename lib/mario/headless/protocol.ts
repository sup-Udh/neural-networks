import type { EvaluationConfig, EvaluationResult } from "../evaluation";
import type { NetworkModel } from "../../nn/network";
import { TERMINATIONS } from "../evaluation";

export type ToWorker =
  | { type: "init"; scriptBase: string; scripts: string[] }
  | { type: "evaluate"; id: number; episodeId: string; model: NetworkModel; config: EvaluationConfig };

export type FromWorker =
  | { type: "ready" }
  | { type: "result"; id: number; result: EvaluationResult }
  | { type: "error"; id: number | null; message: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Validates a message arriving from the worker before the trainer trusts any number in it. */
export function parseFromWorker(data: unknown): FromWorker | null {
  if (!isObj(data)) return null;
  if (data.type === "ready") return { type: "ready" };
  if (data.type === "error" && typeof data.message === "string") return { type: "error", id: typeof data.id === "number" ? data.id : null, message: data.message };
  if (data.type === "result" && typeof data.id === "number" && isObj(data.result)) {
    const r = data.result;
    const m = r.metrics;
    const ok =
      typeof r.episodeId === "string" && typeof r.fitness === "number" && Number.isFinite(r.fitness) &&
      typeof r.termination === "string" && (TERMINATIONS as readonly string[]).includes(r.termination) &&
      isObj(m) && typeof m.distance === "number" && Number.isFinite(m.distance) && typeof m.frames === "number";
    return ok ? { type: "result", id: data.id, result: data.result as unknown as EvaluationResult } : null;
  }
  return null;
}

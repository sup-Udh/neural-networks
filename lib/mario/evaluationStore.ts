import type { NetworkModel } from "../nn/network";
import { DEFAULT_EVAL_CONFIG } from "./evaluation";
import type { EvaluationConfig, Evaluator, SceneCapture, SceneProber } from "./evaluation";
import { WorkerEvaluator } from "./headless/workerEvaluator";
import { evaluateJob } from "./validation";
import type { BatchJob, EvaluationRecord } from "./validation";
import { recordEvaluations, workspaceStore } from "./workspace";

/*
 * Runs batches of matched evaluations (and one-off scene captures) in a throw-away worker, outside React.
 * Results are persisted as EvaluationRecords in the workspace. One batch at a time; Stop terminates the worker.
 */
export interface BatchLive {
  running: boolean;
  done: number;
  total: number;
  error: string | null;
}

let live: BatchLive = { running: false, done: 0, total: 0, error: null };
const listeners = new Set<() => void>();
let evaluator: (Evaluator & SceneProber) | null = null;
let stopped = false;

const set = (next: BatchLive) => {
  live = next;
  listeners.forEach((l) => l());
};

export type EvaluatorFactory = () => Evaluator & SceneProber;
const defaultFactory: EvaluatorFactory = () => new WorkerEvaluator();

export const evaluationStore = {
  get: () => live,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },

  /** Evaluates every job under the same base config. Resolves with the records that finished (all, unless stopped/failed). */
  async run(jobs: BatchJob[], base: EvaluationConfig = DEFAULT_EVAL_CONFIG, makeEvaluator: EvaluatorFactory = defaultFactory): Promise<EvaluationRecord[]> {
    if (live.running) throw new Error("An evaluation is already running.");
    stopped = false;
    const done: EvaluationRecord[] = [];
    let ev: Evaluator & SceneProber;
    try {
      ev = makeEvaluator();
    } catch (error) {
      set({ running: false, done: 0, total: jobs.length, error: `Could not start the evaluation worker: ${error instanceof Error ? error.message : String(error)}` });
      return done;
    }
    evaluator = ev;
    set({ running: true, done: 0, total: jobs.length, error: null });
    const prefix = `eval-${Date.now().toString(36)}`;
    try {
      for (let i = 0; i < jobs.length; i++) {
        const record = await evaluateJob(ev, jobs[i], base, `${prefix}-${i}`, () => stopped);
        done.push(record);
        workspaceStore.set(recordEvaluations(workspaceStore.get(), [record]));
        set({ running: true, done: i + 1, total: jobs.length, error: null });
      }
      set({ running: false, done: jobs.length, total: jobs.length, error: null });
    } catch (error) {
      set({ running: false, done: done.length, total: jobs.length, error: stopped ? "Evaluation stopped." : error instanceof Error ? error.message : String(error) });
    } finally {
      ev.dispose();
      if (evaluator === ev) evaluator = null;
    }
    return done;
  },

  stop() {
    stopped = true;
    evaluator?.dispose();
  },
};

/** One-off scene capture in its own worker (see captureSceneSync). */
export async function captureSceneOnce(model: NetworkModel, targetX: number, config: EvaluationConfig = DEFAULT_EVAL_CONFIG, makeEvaluator: EvaluatorFactory = defaultFactory): Promise<SceneCapture | null> {
  const ev = makeEvaluator();
  try {
    return await ev.captureScene(model, config, targetX);
  } finally {
    ev.dispose();
  }
}

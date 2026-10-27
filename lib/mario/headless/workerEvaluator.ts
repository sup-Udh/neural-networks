import type { NetworkModel } from "../../nn/network";
import type { EvaluationConfig, EvaluationResult, Evaluator } from "../evaluation";
import { HeadlessEvaluator } from "../evaluation";
import type { MarioHooks } from "../controller";
import { LEGACY_SCRIPTS, SCRIPT_BASE } from "../gameScripts";
import { parseFromWorker } from "./protocol";
import type { ToWorker } from "./protocol";

type Pending = { resolve: (r: EvaluationResult) => void; reject: (e: Error) => void };

/**
 * Evaluator backed by a dedicated Web Worker holding its own copy of the game. `dispose()` terminates the worker
 * and rejects anything in flight, so stopping training never leaves a simulation running in the background.
 */
export class WorkerEvaluator implements Evaluator {
  private worker: Worker | null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private ready: Promise<void>;
  private disposed = false;

  constructor(makeWorker: () => Worker = () => new Worker(new URL("./evaluationWorker.ts", import.meta.url), { type: "module" })) {
    const worker = makeWorker();
    this.worker = worker;
    this.ready = new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent) => {
        const m = parseFromWorker(event.data);
        if (!m) return this.failAll(new Error("The evaluation worker sent an invalid message."));
        if (m.type === "ready") resolve();
        else if (m.type === "error") {
          const p = m.id === null ? null : this.pending.get(m.id);
          if (p) {
            this.pending.delete(m.id!);
            p.reject(new Error(m.message));
          } else {
            reject(new Error(m.message));
            this.failAll(new Error(m.message));
          }
        } else {
          const p = this.pending.get(m.id);
          this.pending.delete(m.id);
          p?.resolve(m.result);
        }
      };
      worker.onerror = (e) => {
        e.preventDefault();
        const err = new Error(e.message || "The evaluation worker crashed.");
        reject(err);
        this.failAll(err);
      };
    });
    this.ready.catch(() => undefined); // surfaced through evaluate(); avoid an unhandled rejection here
    worker.postMessage({ type: "init", scriptBase: SCRIPT_BASE, scripts: [...LEGACY_SCRIPTS] } satisfies ToWorker);
  }

  private failAll(error: Error) {
    this.pending.forEach((p) => p.reject(error));
    this.pending.clear();
  }

  async evaluate(model: NetworkModel, config: EvaluationConfig, episodeId: string): Promise<EvaluationResult> {
    await this.ready;
    if (this.disposed || !this.worker) throw new Error("The evaluator has been stopped.");
    const id = this.nextId++;
    return new Promise<EvaluationResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ type: "evaluate", id, episodeId, model, config } satisfies ToWorker);
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.worker?.terminate();
    this.worker = null;
    this.failAll(new Error("The evaluator has been stopped."));
  }
}

/** Same interface, no worker: evaluates against hooks in this thread (used by tests and tools). */
export class InProcessEvaluator implements Evaluator {
  private core: HeadlessEvaluator;
  disposed = false;
  constructor(hooks: MarioHooks) {
    this.core = new HeadlessEvaluator(hooks);
  }
  async evaluate(model: NetworkModel, config: EvaluationConfig, episodeId: string) {
    if (this.disposed) throw new Error("The evaluator has been stopped.");
    return this.core.evaluateSync(model, config, episodeId);
  }
  dispose() {
    this.disposed = true;
  }
}

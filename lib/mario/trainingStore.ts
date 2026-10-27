import type { NetworkModel } from "../nn/network";
import type { TrainingConfig } from "./evolution";
import { WorkerEvaluator } from "./headless/workerEvaluator";
import type { Evaluator } from "./evaluation";
import { Trainer } from "./trainer";
import type { TrainingSession } from "./trainer";
import { recordTraining, workspaceStore } from "./workspace";

/*
 * Owns the one active training run, outside React. Training runs in its own Web Worker with a private copy of the
 * game, so it never touches the visible game or its controller. UI updates are coalesced (≤ ~6 per second).
 */
export interface TrainingLive {
  session: TrainingSession | null;
  startError: string | null;
}

let live: TrainingLive = { session: null, startError: null };
const listeners = new Set<() => void>();
let trainer: Trainer | null = null;
let evaluator: Evaluator | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const notify = () => listeners.forEach((l) => l());
const set = (next: TrainingLive) => {
  live = next;
  notify();
};

const isActive = (s: TrainingSession | null) => !!s && (s.state === "initializing" || s.state === "evaluating" || s.state === "evolving");

export const trainingStore = {
  get: () => live,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  isRunning: () => trainer !== null,

  start(config: TrainingConfig, startModel: NetworkModel, label: string, makeEvaluator: () => Evaluator = () => new WorkerEvaluator()) {
    if (trainer) return;
    let ev: Evaluator;
    try {
      ev = makeEvaluator();
    } catch (error) {
      set({ session: live.session, startError: `Could not start the evaluation worker: ${error instanceof Error ? error.message : String(error)}` });
      return;
    }
    evaluator = ev;
    const t = new Trainer(ev, config, startModel, label, (session) => {
      const terminal = !isActive(session);
      if (terminal) {
        if (timer) clearTimeout(timer);
        timer = null;
        set({ session, startError: null });
      } else if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          set({ session: t.getSession(), startError: null });
        }, 160);
      }
    });
    trainer = t;
    set({ session: t.getSession(), startError: null });
    void t.run().then((session) => {
      // Keep whatever was measured, including cancelled or failed runs, as long as at least one generation finished.
      if (session.generations.length > 0) workspaceStore.set(recordTraining(workspaceStore.get(), session));
    }).finally(() => {
      ev.dispose();
      if (evaluator === ev) evaluator = null;
      if (trainer === t) trainer = null;
      notify();
    });
  },

  /** Stops the run: marks it cancelled and terminates the worker so no simulation keeps running. */
  stop() {
    trainer?.cancel();
    evaluator?.dispose();
  },

  /** Clears the displayed (finished) session; saved sessions in the workspace are untouched. */
  clear() {
    if (trainer) return;
    set({ session: null, startError: null });
  },
};

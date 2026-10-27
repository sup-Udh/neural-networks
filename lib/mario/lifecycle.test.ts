// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_EVAL_CONFIG } from "./evaluation";
import type { EvaluationConfig, EvaluationResult, Evaluator } from "./evaluation";
import { DEFAULT_TRAINING_CONFIG } from "./evolution";
import { parseFromWorker } from "./headless/protocol";
import { WorkerEvaluator } from "./headless/workerEvaluator";
import { starterModel } from "./starter";
import { trainingStore } from "./trainingStore";
import { workspaceStore } from "./workspace";
import type { NetworkModel } from "../nn/network";

/** A fake Worker: records messages and lets the test reply, so only the client protocol and lifecycle are tested. */
class FakeWorker {
  sent: Record<string, unknown>[] = [];
  terminated = false;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage(m: Record<string, unknown>) {
    this.sent.push(m);
  }
  terminate() {
    this.terminated = true;
  }
  reply(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}
const asWorker = (w: FakeWorker) => () => w as unknown as Worker;
const goodResult = (id: string): EvaluationResult => ({
  episodeId: id, termination: "dead", reason: "x", fitness: 12, breakdown: { progress: 12, completionBonus: 0, deathPenalty: 0 }, config: DEFAULT_EVAL_CONFIG,
  metrics: { status: "dead", frames: 10, startX: 56, maxX: 68, distance: 12, progress: 0, jumps: 0, coins: 0 },
});

describe("worker message protocol", () => {
  it("accepts well-formed results and rejects malformed ones", () => {
    expect(parseFromWorker({ type: "ready" })).toEqual({ type: "ready" });
    expect(parseFromWorker({ type: "result", id: 1, result: goodResult("a") })?.type).toBe("result");
    expect(parseFromWorker({ type: "result", id: 1, result: { ...goodResult("a"), fitness: NaN } })).toBeNull();
    expect(parseFromWorker({ type: "result", id: 1, result: { ...goodResult("a"), termination: "teleported" } })).toBeNull();
    expect(parseFromWorker({ type: "result", id: "1", result: goodResult("a") })).toBeNull();
    expect(parseFromWorker("nope")).toBeNull();
  });
});

describe("WorkerEvaluator lifecycle", () => {
  it("sends init, waits for ready, evaluates, and resolves with the validated result", async () => {
    const w = new FakeWorker();
    const ev = new WorkerEvaluator(asWorker(w));
    expect(w.sent[0].type).toBe("init");
    const p = ev.evaluate(starterModel(), DEFAULT_EVAL_CONFIG, "ep1");
    expect(w.sent.some((m) => m.type === "evaluate")).toBe(false); // not before the worker is ready
    w.reply({ type: "ready" });
    await Promise.resolve();
    await Promise.resolve();
    const req = w.sent.find((m) => m.type === "evaluate")!;
    expect(req.episodeId).toBe("ep1");
    w.reply({ type: "result", id: req.id, result: goodResult("ep1") });
    await expect(p).resolves.toMatchObject({ episodeId: "ep1", fitness: 12 });
  });
  it("rejects in-flight work and terminates the worker on dispose", async () => {
    const w = new FakeWorker();
    const ev = new WorkerEvaluator(asWorker(w));
    w.reply({ type: "ready" });
    const p = ev.evaluate(starterModel(), DEFAULT_EVAL_CONFIG, "ep");
    await Promise.resolve();
    await Promise.resolve();
    ev.dispose();
    await expect(p).rejects.toThrow(/stopped/);
    expect(w.terminated).toBe(true);
    await expect(ev.evaluate(starterModel(), DEFAULT_EVAL_CONFIG, "late")).rejects.toThrow(/stopped/);
    ev.dispose(); // idempotent
  });
  it("surfaces worker errors per request and rejects invalid messages", async () => {
    const w = new FakeWorker();
    const ev = new WorkerEvaluator(asWorker(w));
    w.reply({ type: "ready" });
    const p = ev.evaluate(starterModel(), DEFAULT_EVAL_CONFIG, "e");
    await Promise.resolve();
    await Promise.resolve();
    const id = w.sent.find((m) => m.type === "evaluate")!.id;
    w.reply({ type: "error", id, message: "boom" });
    await expect(p).rejects.toThrow("boom");
    const p2 = ev.evaluate(starterModel(), DEFAULT_EVAL_CONFIG, "e2");
    await Promise.resolve();
    await Promise.resolve();
    w.reply({ type: "result", id: 99, result: { garbage: true } });
    await expect(p2).rejects.toThrow(/invalid message/);
  });
  it("fails evaluation clearly when the worker cannot boot", async () => {
    const w = new FakeWorker();
    const ev = new WorkerEvaluator(asWorker(w));
    w.reply({ type: "error", id: null, message: "Could not load game.js (404)." });
    await expect(ev.evaluate(starterModel(), DEFAULT_EVAL_CONFIG, "e")).rejects.toThrow(/game\.js/);
  });
});

describe("trainingStore (fixture evaluator)", () => {
  beforeAll(() => {
    // The workspace store persists through window.localStorage; give plain Node a minimal in-memory one.
    const mem = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });
  });

  class SlowFixture implements Evaluator {
    calls = 0;
    disposed = false;
    constructor(private delayMs = 2) {}
    async evaluate(model: NetworkModel, config: EvaluationConfig, episodeId: string) {
      await new Promise((r) => setTimeout(r, this.delayMs));
      if (this.disposed) throw new Error("stopped");
      this.calls++;
      return goodResult(episodeId);
    }
    dispose() {
      this.disposed = true;
    }
  }
  const cfg = { ...DEFAULT_TRAINING_CONFIG, populationSize: 4, generations: 2, eliteCount: 1 };
  const until = async (pred: () => boolean) => {
    for (let i = 0; i < 400 && !pred(); i++) await new Promise((r) => setTimeout(r, 5));
  };

  it("runs a session, stores it in the workspace and disposes the evaluator", async () => {
    const ev = new SlowFixture();
    trainingStore.start(cfg, starterModel(), "Starter", () => ev);
    expect(trainingStore.isRunning()).toBe(true);
    await until(() => !trainingStore.isRunning());
    expect(trainingStore.get().session?.state).toBe("completed");
    expect(ev.disposed).toBe(true);
    expect(workspaceStore.get().trainings.some((t) => t.id === trainingStore.get().session!.id)).toBe(true);
  });
  it("ignores a second start while running, and stop cancels, disposes and keeps measured generations", async () => {
    const ev = new SlowFixture(15);
    trainingStore.start({ ...cfg, generations: 40 }, starterModel(), "Starter", () => ev);
    const second = new SlowFixture();
    trainingStore.start(cfg, starterModel(), "Other", () => second);
    expect(second.calls).toBe(0); // second start was ignored
    await until(() => (trainingStore.get().session?.generations.length ?? 0) >= 1);
    trainingStore.stop();
    await until(() => !trainingStore.isRunning());
    expect(trainingStore.get().session?.state).toBe("cancelled");
    expect(ev.disposed).toBe(true);
    const calls = ev.calls;
    await new Promise((r) => setTimeout(r, 60));
    expect(ev.calls).toBe(calls);
    expect(workspaceStore.get().trainings[0].state).toBe("cancelled");
  }, 15_000);
  it("reports a start failure instead of hanging", () => {
    trainingStore.start(cfg, starterModel(), "Starter", () => {
      throw new Error("no Worker support");
    });
    expect(trainingStore.isRunning()).toBe(false);
    expect(trainingStore.get().startError).toMatch(/no Worker support/);
  });
});

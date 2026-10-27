// @vitest-environment node
import { describe, expect, it } from "vitest";
import { forward, validateModel } from "../nn/network";
import type { NetworkModel } from "../nn/network";
import { DEFAULT_EVAL_CONFIG, computeFitness } from "./evaluation";
import type { EvaluationConfig, EvaluationResult, Evaluator } from "./evaluation";
import { DEFAULT_TRAINING_CONFIG, initPopulation, makeRng, mutateModel, nextPopulation, rankCandidates, validateTrainingConfig } from "./evolution";
import type { EvaluatedCandidate, TrainingConfig } from "./evolution";
import { InProcessEvaluator } from "./headless/workerEvaluator";
import { bootGameInVm } from "./headless/vmLoader";
import { starterModel } from "./starter";
import { Trainer } from "./trainer";
import type { TrainingSession } from "./trainer";
import { initialWorkspace, promoteModel, recordTraining, MAX_TRAININGS } from "./workspace";

const cfg = (over: Partial<TrainingConfig> = {}): TrainingConfig => ({ ...DEFAULT_TRAINING_CONFIG, populationSize: 8, generations: 4, eliteCount: 2, ...over });
const paramSum = (m: NetworkModel) => m.layers.reduce((s, l) => s + l.weights.flat().reduce((a, b) => a + b, 0) + l.biases.reduce((a, b) => a + b, 0), 0);

/* ---------- Fixture-based algorithm tests (no game; fitness is a deterministic function of the parameters) ---------- */
/** Fixture evaluator: fitness = sum of all parameters (a smooth function evolution can climb). NOT a game result. */
class FixtureEvaluator implements Evaluator {
  calls = 0;
  disposed = false;
  failOn: (n: number) => boolean = () => false;
  async evaluate(model: NetworkModel, config: EvaluationConfig, episodeId: string): Promise<EvaluationResult> {
    if (this.disposed) throw new Error("stopped");
    const n = this.calls++;
    if (this.failOn(n)) throw new Error("simulated worker failure");
    const distance = paramSum(model);
    const { fitness, breakdown } = computeFitness(distance, "budget", config.fitness);
    return { episodeId, termination: "budget", reason: "fixture", metrics: { status: "running", frames: 1, startX: 0, maxX: distance, distance, progress: 0, jumps: 0, coins: 0 }, fitness, breakdown, config };
  }
  dispose() {
    this.disposed = true;
  }
}

describe("config validation", () => {
  it("accepts defaults", () => expect(validateTrainingConfig(DEFAULT_TRAINING_CONFIG)).toEqual([]));
  it.each([
    [{ populationSize: 2 }, /Population/],
    [{ populationSize: 100 }, /Population/],
    [{ generations: 0 }, /Generations/],
    [{ mutationRate: 0 }, /Mutation rate/],
    [{ mutationStrength: 5 }, /Mutation strength/],
    [{ eliteCount: 0 }, /Elite/],
    [{ eliteCount: 9 }, /Elite/],
    [{ seed: 1.5 }, /Seed/],
    [{ populationSize: 64, generations: 100, eval: { ...DEFAULT_EVAL_CONFIG, maxFrames: 3000 } }, /more than/],
  ] as [Partial<TrainingConfig>, RegExp][])("rejects %j", (over, re) => {
    expect(validateTrainingConfig(cfg(over)).join(" ")).toMatch(re);
  });
});

describe("mutation", () => {
  it("returns a new valid model and never touches the original", () => {
    const m = starterModel();
    const before = JSON.stringify(m);
    const child = mutateModel(m, 1, 0.5, makeRng(3));
    expect(JSON.stringify(m)).toBe(before);
    expect(child).not.toBe(m);
    expect(child.layers[0].weights).not.toBe(m.layers[0].weights);
    expect(validateModel(child)).toEqual([]);
  });
  it("preserves architecture, activations and input compatibility", () => {
    const child = mutateModel(starterModel(), 1, 1, makeRng(4));
    expect(child.inputSize).toBe(5);
    expect(child.layers.map((l) => [l.weights.length, l.weights[0].length, l.biases.length, l.activation])).toEqual(
      starterModel().layers.map((l) => [l.weights.length, l.weights[0].length, l.biases.length, l.activation]),
    );
    expect(() => forward(child, [0, 0, 0, 0, 1])).not.toThrow();
  });
  it("rate 1 changes nearly every parameter, a tiny rate changes few", () => {
    const count = (a: NetworkModel, b: NetworkModel) => a.layers.reduce((n, l, i) => n + l.weights.flat().filter((w, j) => w !== b.layers[i].weights.flat()[j]).length + l.biases.filter((x, j) => x !== b.layers[i].biases[j]).length, 0);
    const base = starterModel();
    const total = 5 * 5 + 5 + 5 * 3 + 3;
    expect(count(base, mutateModel(base, 1, 0.5, makeRng(1)))).toBeGreaterThan(total * 0.9);
    expect(count(base, mutateModel(base, 0.02, 0.5, makeRng(1)))).toBeLessThan(total * 0.3);
  });
  it("mutation size scales with strength and parameters stay bounded", () => {
    const base = starterModel();
    const dist = (s: number) => { const c = mutateModel(base, 1, s, makeRng(9)); return Math.abs(paramSum(c) - paramSum(base)); };
    expect(dist(1.5)).toBeGreaterThan(0);
    const huge = mutateModel(base, 1, 2, makeRng(2));
    expect(huge.layers.flatMap((l) => [...l.weights.flat(), ...l.biases]).every((v) => Math.abs(v) <= 10)).toBe(true);
  });
  it("is reproducible for a seed", () => expect(mutateModel(starterModel(), 0.5, 0.5, makeRng(7))).toEqual(mutateModel(starterModel(), 0.5, 0.5, makeRng(7))));
});

describe("population", () => {
  it("starts with the unmutated start model plus independent mutants", () => {
    const start = starterModel();
    const pop = initPopulation(start, cfg(), makeRng(1));
    expect(pop).toHaveLength(8);
    expect(pop[0].model).toEqual(start);
    expect(pop[0].model).not.toBe(start);
    expect(new Set(pop.map((p) => p.id)).size).toBe(8);
    expect(pop.slice(1).some((p) => JSON.stringify(p.model) !== JSON.stringify(start))).toBe(true);
    pop[1].model.layers[0].weights[0][0] = 99; // editing one candidate must not leak anywhere
    expect(pop[2].model.layers[0].weights[0][0]).not.toBe(99);
    expect(pop[0].model.layers[0].weights[0][0]).toBe(2);
    expect(start.layers[0].weights[0][0]).toBe(2);
  });
  it("ranks by fitness, ties by index, failures last", () => {
    const mk = (index: number, fitness: number | null): EvaluatedCandidate => ({
      id: `c${index}`, generation: 0, index, parentId: null, origin: "mutant", model: starterModel(), error: fitness === null ? "boom" : null,
      result: fitness === null ? null : ({ fitness } as EvaluationResult),
    });
    expect(rankCandidates([mk(0, 5), mk(1, null), mk(2, 9), mk(3, 5)]).map((c) => c.index)).toEqual([2, 0, 3, 1]);
  });
  it("keeps elites unchanged and breeds the rest from the stronger half", () => {
    const rng = makeRng(5);
    const pop = initPopulation(starterModel(), cfg(), rng);
    const evaluated: EvaluatedCandidate[] = pop.map((p, i) => ({ ...p, error: null, result: { fitness: 100 - i } as EvaluationResult }));
    const ranked = rankCandidates(evaluated);
    const next = nextPopulation(ranked, 1, cfg(), rng);
    expect(next).toHaveLength(8);
    expect(next[0].origin).toBe("elite");
    expect(next[0].model).toEqual(ranked[0].model);
    expect(next[0].model).not.toBe(ranked[0].model);
    expect(next[1].model).toEqual(ranked[1].model);
    const topHalf = new Set(ranked.slice(0, 4).map((c) => c.id));
    expect(next.slice(2).every((c) => c.origin === "mutant" && topHalf.has(c.parentId!))).toBe(true);
  });
  it("never breeds from failed candidates and errors when all failed", () => {
    const pop = initPopulation(starterModel(), cfg(), makeRng(1));
    const failed = pop.map((p) => ({ ...p, result: null, error: "x" }));
    expect(() => nextPopulation(failed, 1, cfg(), makeRng(1))).toThrow(/failed/);
  });
});

describe("trainer (fixture evaluator)", () => {
  const run = async (c = cfg(), ev = new FixtureEvaluator()) => {
    const states: string[] = [];
    const t = new Trainer(ev, c, starterModel(), "Starter", (s) => states.push(s.state));
    const session = await t.run();
    return { session, states, ev, t };
  };

  it("runs the full generation loop and records measured results", async () => {
    const { session, states } = await run();
    expect(session.state).toBe("completed");
    expect(session.generations).toHaveLength(4);
    expect(session.candidatesEvaluated).toBe(32);
    expect(states[0]).toBe("initializing");
    expect(states).toContain("evaluating");
    expect(states).toContain("evolving");
    session.generations.forEach((g) => {
      expect(g.evaluated).toBe(8);
      expect(g.best!.fitness).toBeGreaterThanOrEqual(g.avgFitness!);
      expect(g.avgFitness!).toBeGreaterThanOrEqual(g.worstFitness!);
      expect(g.candidates).toHaveLength(8);
    });
  });
  it("elitism: best fitness never drops and the global best matches the maximum seen", async () => {
    const { session } = await run(cfg({ generations: 6 }));
    const bests = session.generations.map((g) => g.best!.fitness);
    bests.forEach((b, i) => i > 0 && expect(b).toBeGreaterThanOrEqual(bests[i - 1]));
    expect(session.globalBest!.fitness).toBe(Math.max(...bests));
  });
  it("is reproducible for the same seed and differs for another", async () => {
    const a = await run(cfg({ seed: 11 }));
    const b = await run(cfg({ seed: 11 }));
    const c = await run(cfg({ seed: 12 }));
    expect(a.session.generations.map((g) => g.best!.fitness)).toEqual(b.session.generations.map((g) => g.best!.fitness));
    expect(a.session.generations.map((g) => g.best!.fitness)).not.toEqual(c.session.generations.map((g) => g.best!.fitness));
  });
  it("tracks mutation actually changing parameters across generations", async () => {
    const { session } = await run();
    expect(JSON.stringify(session.globalBest!.model)).not.toBe(JSON.stringify(starterModel()));
  });
  it("keeps the start model and the saved best isolated from later mutation", async () => {
    const start = starterModel();
    const t = new Trainer(new FixtureEvaluator(), cfg(), start, "Starter", () => undefined);
    const session = await t.run();
    expect(start).toEqual(starterModel());
    expect(session.startModel).toEqual(starterModel());
    const best = session.globalBest!;
    const frozen = JSON.stringify(best.model);
    session.generations.forEach((g) => g.best && (g.best.model.layers[0].biases[0] = 123)); // tamper with another record
    expect(JSON.stringify(best.model)).toBe(frozen);
  });
  it("reports failed evaluations instead of inventing scores", async () => {
    const ev = new FixtureEvaluator();
    ev.failOn = (n) => n === 3 || n === 4;
    const { session } = await run(cfg(), ev);
    expect(session.failures).toBe(2);
    expect(session.generations[0].failed).toBe(2); // evaluator calls 3 and 4 both fall in generation 0
    expect(session.generations[0].evaluated).toBe(6);
    expect(session.generations[0].candidates.filter((c) => c.fitness === null && c.error === "simulated worker failure")).toHaveLength(2);
    expect(session.state).toBe("completed");
  });
  it("errors visibly when a whole generation fails", async () => {
    const ev = new FixtureEvaluator();
    ev.failOn = () => true;
    const { session } = await run(cfg(), ev);
    expect(session.state).toBe("error");
    expect(session.error).toMatch(/every candidate failed/i);
  });
  it("rejects invalid configuration before evaluating anything", async () => {
    const { session, ev } = await run(cfg({ populationSize: 1 }));
    expect(session.state).toBe("error");
    expect(ev.calls).toBe(0);
  });
  it("cancels cleanly between candidates and stops calling the evaluator", async () => {
    const ev = new FixtureEvaluator();
    let seen = 0;
    const t: Trainer = new Trainer(ev, cfg({ generations: 50 }), starterModel(), "Starter", (s) => {
      if (s.candidatesEvaluated >= 5 && seen++ === 0) t.cancel();
    });
    const session = await t.run();
    expect(session.state).toBe("cancelled");
    const calls = ev.calls;
    await new Promise((r) => setTimeout(r, 20));
    expect(ev.calls).toBe(calls); // nothing keeps running afterwards
    expect(calls).toBeLessThan(50 * 8);
  });
  it("cannot be started twice at once", async () => {
    const t = new Trainer(new FixtureEvaluator(), cfg(), starterModel(), "Starter", () => undefined);
    const first = t.run();
    await expect(t.run()).rejects.toThrow(/already running/);
    await first;
  });
});

describe("workspace integration (fixtures)", () => {
  const session = async (): Promise<TrainingSession> => new Trainer(new FixtureEvaluator(), cfg(), starterModel(), "Starter", () => undefined).run();
  it("promotes a trained model without touching the saved session", async () => {
    const s = await session();
    const w = initialWorkspace();
    const promoted = promoteModel(w, s.globalBest!.model, "Trained g1-c3");
    expect(promoted.model).toEqual(s.globalBest!.model);
    expect(promoted.model).not.toBe(s.globalBest!.model);
    expect(promoted.revision).toBe(w.revision + 1);
    promoted.model.layers[0].biases[0] = 77;
    expect(s.globalBest!.model.layers[0].biases[0]).not.toBe(77);
  });
  it("stores sessions newest-first with a retention cap and survives a JSON round trip", async () => {
    let w = initialWorkspace();
    for (let i = 0; i < MAX_TRAININGS + 2; i++) w = recordTraining(w, { ...(await session()), id: `s${i}` });
    expect(w.trainings).toHaveLength(MAX_TRAININGS);
    expect(w.trainings[0].id).toBe(`s${MAX_TRAININGS + 1}`);
    expect(JSON.parse(JSON.stringify(w.trainings[0])).globalBest.model).toEqual(w.trainings[0].globalBest!.model);
  });
});

/* ---------- Integration: real Mario episodes through the evaluator interface ---------- */
describe("training against the real game (integration)", () => {
  it("evaluates every candidate in a fresh real episode and keeps the best", async () => {
    const hooks = await bootGameInVm();
    const evaluator = new InProcessEvaluator(hooks);
    const config = cfg({ populationSize: 6, generations: 3, eliteCount: 1, seed: 3, eval: { ...DEFAULT_EVAL_CONFIG, maxFrames: 700, stallFrames: 200 } });
    const session = await new Trainer(evaluator, config, starterModel(), "Starter", () => undefined).run();
    expect(session.state).toBe("completed");
    expect(session.candidatesEvaluated).toBe(18);
    // Candidate 0 of generation 0 is the unmodified starter: it must score exactly what a standalone run of the starter scores.
    const standalone = await evaluator.evaluate(starterModel(), config.eval, "check");
    const baseline = session.generations[0].candidates.find((c) => c.id === "g0-c0")!;
    expect(baseline.fitness).toBe(standalone.fitness);
    expect(baseline.distance).toBe(standalone.metrics.distance);
    const bests = session.generations.map((g) => g.best!.fitness);
    bests.forEach((b, i) => i > 0 && expect(b).toBeGreaterThanOrEqual(bests[i - 1]));
    expect(session.globalBest!.fitness).toBeGreaterThanOrEqual(baseline.fitness!);
    expect(session.generations.every((g) => g.candidates.every((c) => c.fitness !== null))).toBe(true);
  }, 60_000);
});

// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { cloneModel } from "../nn/network";
import { DEFAULT_EVAL_CONFIG, HeadlessEvaluator, computeFitness, validateEvalConfig } from "./evaluation";
import type { EvaluationConfig } from "./evaluation";
import { bootGameInVm } from "./headless/vmLoader";
import { starterModel } from "./starter";

/* ---- Fixture tests: pure functions, no game involved ---- */
describe("fitness (fixtures)", () => {
  const w = DEFAULT_EVAL_CONFIG.fitness;
  it("rewards progress only", () => expect(computeFitness(500, "stalled", w).fitness).toBe(500));
  it("applies the death penalty only on death", () => {
    expect(computeFitness(500, "dead", w).fitness).toBe(400);
    expect(computeFitness(500, "budget", w).fitness).toBe(500);
    expect(computeFitness(500, "stalled", w).breakdown.deathPenalty).toBe(0);
  });
  it("adds the completion bonus only on completion", () => {
    expect(computeFitness(3000, "completed", w).fitness).toBe(5000);
    expect(computeFitness(3000, "dead", w).breakdown.completionBonus).toBe(0);
  });
  it("never lets negative distance score", () => expect(computeFitness(-50, "budget", w).fitness).toBe(0));
  it("keeps the breakdown consistent with the total", () => {
    const r = computeFitness(1234, "dead", w);
    expect(r.breakdown.progress + r.breakdown.completionBonus - r.breakdown.deathPenalty).toBe(r.fitness);
  });
});

describe("evaluation config validation (fixtures)", () => {
  it("accepts the defaults", () => expect(validateEvalConfig(DEFAULT_EVAL_CONFIG)).toEqual([]));
  it("rejects bad budgets and weights", () => {
    expect(validateEvalConfig({ ...DEFAULT_EVAL_CONFIG, maxFrames: 5 }).length).toBeGreaterThan(0);
    expect(validateEvalConfig({ ...DEFAULT_EVAL_CONFIG, stallFrames: 99999 }).length).toBeGreaterThan(0);
    expect(validateEvalConfig({ ...DEFAULT_EVAL_CONFIG, fitness: { ...DEFAULT_EVAL_CONFIG.fitness, progressPerPixel: 0 } }).length).toBeGreaterThan(0);
  });
});

/* ---- Real-engine tests: the actual game scripts run in a vm with stubbed DOM/canvas/audio ---- */
describe("evaluation against the real game engine", () => {
  let game: Awaited<ReturnType<typeof bootGameInVm>>;
  let ev: HeadlessEvaluator;
  const cfg: EvaluationConfig = { ...DEFAULT_EVAL_CONFIG, maxFrames: 3000, stallFrames: 300 };
  beforeAll(async () => {
    game = await bootGameInVm();
    ev = new HeadlessEvaluator(game);
  });

  const waitModel = () => {
    const m = starterModel();
    m.layers[1].biases = [0, 0, 5]; // wait always wins
    return m;
  };
  const noJumpModel = () => {
    const m = starterModel();
    m.layers[1].weights[1] = [0, 0, 0, 0, 0]; // never jumps, always runs right
    return m;
  };

  it("reset puts the game back at the start of World 1-1 with clean state", () => {
    ev.evaluateSync(starterModel(), { ...cfg, maxFrames: 200 }, "warmup");
    game.reset();
    const s = game.snapshot();
    expect(s.player.x).toBe(56);
    expect(s.player.y).toBe(192);
    expect(s.viewportX).toBe(0);
    expect(s.frame).toBe(0);
    expect(game.keys === null || Object.keys(game.keys).length === 0).toBe(true);
  });

  it("is deterministic: identical model and conditions give identical results, even after other episodes", () => {
    const a = ev.evaluateSync(starterModel(), cfg, "a");
    ev.evaluateSync(noJumpModel(), cfg, "between"); // a different episode in the same game instance
    const b = ev.evaluateSync(starterModel(), cfg, "b");
    expect({ ...a, episodeId: "" }).toEqual({ ...b, episodeId: "" });
  });

  it("sees warp pipes as obstacles (regression: the starter used to stall at the first warp pipe at x=896)", () => {
    game.reset();
    const s = game.snapshot();
    expect(s.isSolid(57, 9)).toBe(true); // putRealPipe(57, 9, 4) occupies rows 9–12 of columns 57–58
    expect(s.isSolid(58, 12)).toBe(true);
    expect(s.isSolid(57, 8)).toBe(false);
    const r = ev.evaluateSync(starterModel(), cfg, "starter");
    expect(r.metrics.distance).toBeGreaterThan(1500);
  });

  it("stops at the first death, so the game's automatic respawn cannot extend or inflate an episode", () => {
    const r = ev.evaluateSync(noJumpModel(), cfg, "dies");
    expect(r.termination).toBe("dead");
    expect(r.metrics.frames).toBeLessThan(600); // dies at the first goomba, long before the 3000-frame budget
    expect(r.metrics.distance).toBeLessThan(600);
    expect(r.breakdown.deathPenalty).toBe(cfg.fitness.deathPenalty);
    expect(r.fitness).toBe(r.metrics.distance - cfg.fitness.deathPenalty);
  });

  it("a model that never moves scores about zero and is 'stalled', not dead", () => {
    const r = ev.evaluateSync(waitModel(), cfg, "waits");
    expect(r.termination).toBe("stalled");
    expect(r.metrics.distance).toBeLessThan(5);
    expect(r.breakdown.deathPenalty).toBe(0);
    expect(r.fitness).toBeLessThan(5);
  });

  it("ends at the frame budget without calling it death", () => {
    const r = ev.evaluateSync(starterModel(), { ...cfg, maxFrames: 120 }, "short");
    expect(r.termination).toBe("budget");
    expect(r.metrics.frames).toBe(121); // frames 0..120 observed
    expect(r.breakdown.deathPenalty).toBe(0);
  });

  it("detects level completion from the real flagpole code and awards the bonus only then", () => {
    // Fixture-assisted: the position is staged near the flagpole, then the game's own Flag.isPlayerCollided runs.
    const r = ev.evaluateSync(starterModel(), cfg, "flag", (p) => {
      if (p.frame === 5) game.global.player.pos[0] = 198 * 16 + 2;
    });
    expect(r.termination).toBe("completed");
    expect(r.metrics.status).toBe("completed");
    expect(r.breakdown.completionBonus).toBe(cfg.fitness.completionBonus);
  });

  it("clears held keys and hooks after an episode", () => {
    ev.evaluateSync(starterModel(), { ...cfg, maxFrames: 100 }, "x");
    expect(game.keys).toBeNull();
    expect(game.beforeUpdate).toBeNull();
  });

  it("rejects invalid configs instead of running", () => {
    expect(() => ev.evaluateSync(starterModel(), { ...cfg, maxFrames: 1 }, "bad")).toThrow(/Frame budget/);
  });

  it("does not mutate the model it evaluates", () => {
    const m = starterModel();
    const before = JSON.stringify(m);
    ev.evaluateSync(m, { ...cfg, maxFrames: 200 }, "pure");
    expect(JSON.stringify(m)).toBe(before);
    expect(cloneModel(m)).toEqual(m);
  });
});

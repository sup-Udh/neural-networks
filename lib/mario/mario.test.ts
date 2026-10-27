import { describe, expect, it } from "vitest";
import { JUMP_HOLD_FRAMES, KeyDriver, selectAction } from "./actions";
import { MarioController } from "./controller";
import type { Decision, MarioHooks } from "./controller";
import { EpisodeTracker } from "./episode";
import { encodeObservation } from "./observation";
import type { GameSnapshot } from "./observation";
import { starterModel } from "./starter";
import { applyCode, diffModels, editWeight, initialWorkspace, recordRun, restoreSnapshot, saveSnapshot } from "./workspace";

const snap = (over: Partial<GameSnapshot["player"]> = {}, extra: Partial<GameSnapshot> = {}): GameSnapshot => ({
  frame: 1,
  viewportX: 0,
  levelExitX: 3000,
  rows: 15,
  player: { x: 56, y: 192, vx: 0, vy: 0, width: 16, height: 16, standing: true, power: 0, coins: 0, dying: false, flagging: false, exiting: false, piping: false, noInput: false, ...over },
  enemies: [],
  isSolid: (col, row) => row >= 13 && col < 20, // flat floor, then a pit from column 20
  ...extra,
});

describe("observation encoder", () => {
  it("encodes a flat floor with nothing nearby as zeros and grounded", () => {
    const o = encodeObservation(snap());
    expect(o.available && o.inputs).toEqual([0, 0, 0, 0, 1]);
  });
  it("measures a wall ahead", () => {
    const o = encodeObservation(snap({}, { isSolid: (c, r) => r >= 13 || (c === 6 && r === 12) }));
    expect(o.available && o.raw.obstacleDistancePx).toBe(24); // wall at x=96, front at 72
    expect(o.available && o.inputs[0]).toBeCloseTo(1 - 24 / 96);
  });
  it("measures a pit and an enemy, ignoring dying enemies", () => {
    const o = encodeObservation(
      snap({ x: 250 }, { enemies: [{ type: "goomba", x: 300, y: 192, vx: -0.5, dying: false }, { type: "goomba", x: 270, y: 192, vx: 0, dying: true }] }),
    );
    expect(o.available && o.raw.pitDistancePx).toBe(320 - 266);
    expect(o.available && o.raw.enemyDistancePx).toBe(300 - 266);
  });
  it("reports unavailable instead of inventing values", () => {
    expect(encodeObservation(snap({ dying: true })).available).toBe(false);
    expect(encodeObservation(snap({ flagging: true })).available).toBe(false);
    expect(encodeObservation(snap({ noInput: true })).available).toBe(false);
  });
  it("clamps velocity", () => {
    const o = encodeObservation(snap({ vx: 9 }));
    expect(o.available && o.inputs[3]).toBe(1);
  });
});

describe("action selection", () => {
  it("picks the highest score", () => expect(selectAction([0.1, 0.9, 0.3]).action).toBe("jump"));
  it("breaks ties by action order", () => expect(selectAction([1, 1, 0]).action).toBe("run"));
  it("waits on invalid output", () => {
    expect(selectAction([NaN, 1, 0]).action).toBe("wait");
    expect(selectAction([1, 2]).action).toBe("wait");
  });
});

describe("key driver (jump edges)", () => {
  it("holds JUMP for a fixed window, releases, and needs landing before re-jumping", () => {
    const d = new KeyDriver();
    const frames: boolean[] = [];
    for (let i = 0; i < JUMP_HOLD_FRAMES; i++) frames.push(!!d.next("jump", i === 0).JUMP);
    expect(frames.every(Boolean)).toBe(true);
    expect(d.next("jump", false).JUMP).toBeFalsy(); // released, airborne
    expect(d.next("jump", true).JUMP).toBeFalsy(); // landed: this frame is the release edge
    expect(d.next("jump", true).JUMP).toBe(true); // a fresh press
  });
  it("does not jump while airborne and never holds keys for wait", () => {
    const d = new KeyDriver();
    expect(d.next("jump", false).JUMP).toBeFalsy();
    expect(d.next("wait", true)).toEqual({});
    expect(d.next("run", true)).toEqual({ RIGHT: true, RUN: true });
  });
});

function fakeHooks(s: GameSnapshot): MarioHooks {
  return { paused: false, keys: null, beforeUpdate: null, frame: s.frame, snapshot: () => s, reset: () => undefined };
}

describe("controller ownership and lifecycle", () => {
  const make = (s = snap()) => {
    const hooks = fakeHooks(s);
    const decisions: (Decision | null)[] = [];
    const c = new MarioController({ hooks, getModel: () => ({ model: starterModel(), revision: 3 }), reportEvery: 1, onDecision: (d) => decisions.push(d) });
    return { hooks, c, decisions };
  };
  it("leaves keys to the keyboard in human mode and takes them in network mode", () => {
    const { hooks, c } = make();
    c.attach();
    hooks.beforeUpdate?.();
    expect(hooks.keys).toBeNull();
    c.setMode("network");
    hooks.beforeUpdate?.();
    expect(hooks.keys).toMatchObject({ RIGHT: true, RUN: true });
  });
  it("releases stale keys when switching back to human or detaching", () => {
    const { hooks, c } = make();
    c.attach();
    c.setMode("network");
    hooks.beforeUpdate?.();
    c.setMode("human");
    expect(hooks.keys).toBeNull();
    c.setMode("network");
    hooks.beforeUpdate?.();
    c.detach();
    expect(hooks.keys).toBeNull();
    expect(hooks.beforeUpdate).toBeNull();
  });
  it("attach is idempotent and repeated attach/detach leaves no stale hook", () => {
    const { hooks, c } = make();
    for (let i = 0; i < 3; i++) {
      c.attach();
      c.attach();
      expect(hooks.beforeUpdate).not.toBeNull();
      c.detach();
      c.detach();
      expect(hooks.beforeUpdate).toBeNull();
    }
  });
  it("starter network runs on flat ground and jumps near an enemy, with a real trace", () => {
    const flat = make();
    flat.c.attach();
    flat.c.setMode("network");
    flat.hooks.beforeUpdate?.();
    expect(flat.decisions.at(-1)?.action).toBe("run");
    expect(flat.decisions.at(-1)?.modelRevision).toBe(3);

    const danger = make(snap({}, { enemies: [{ type: "goomba", x: 84, y: 192, vx: 0, dying: false }] }));
    danger.c.attach();
    danger.c.setMode("network");
    danger.hooks.beforeUpdate?.();
    const d = danger.decisions.at(-1);
    expect(d?.action).toBe("jump");
    expect(d?.trace?.layers).toHaveLength(2);
    expect(danger.hooks.keys?.JUMP).toBe(true);
  });
  it("never actuates when the observation is unavailable", () => {
    const { hooks, c, decisions } = make(snap({ dying: true }));
    c.attach();
    c.setMode("network");
    hooks.beforeUpdate?.();
    expect(hooks.keys).toEqual({});
    expect(decisions.at(-1)?.action).toBeNull();
  });
});

describe("episode tracker", () => {
  it("tracks distance, jumps and death", () => {
    const t = new EpisodeTracker();
    t.observe(snap({ x: 56 }, { frame: 1 }));
    t.observe(snap({ x: 156, standing: false, vy: -6 }, { frame: 2 }));
    const m = t.observe(snap({ x: 200, dying: true }, { frame: 3 }));
    expect(m.distance).toBe(144);
    expect(m.jumps).toBe(1);
    expect(m.status).toBe("dead");
  });
  it("starts a new episode when the frame counter restarts", () => {
    const t = new EpisodeTracker();
    t.observe(snap({ x: 300 }, { frame: 50 }));
    const m = t.observe(snap({ x: 56 }, { frame: 1 }));
    expect(m.distance).toBe(0);
    expect(m.frames).toBe(1);
  });
});

describe("workspace state", () => {
  it("edits produce a new revision and never mutate snapshots", () => {
    let w = initialWorkspace();
    w = saveSnapshot(w, "A");
    const saved = JSON.stringify(w.snapshots[0].model);
    const edited = editWeight(w, 1, 1, 0, 9);
    expect(edited.revision).toBe(w.revision + 1);
    expect(edited.basedOn).toBeNull();
    expect(JSON.stringify(edited.snapshots[0].model)).toBe(saved);
    const restored = restoreSnapshot(edited, edited.snapshots[0].id);
    expect(restored.model.layers[1].weights[1][0]).toBe(4);
    expect(diffModels(edited.model, restored.model)).toEqual([{ where: "L2 n2 w1", a: 9, b: 4 }]);
  });
  it("applying code bumps the code version, and runs record the model used", () => {
    let w = initialWorkspace();
    w = applyCode({ ...w, draftCode: "function decide(){return 'run'}" });
    expect(w.codeVersion).toBe(2);
    w = recordRun(w, "network", { status: "dead", frames: 10, startX: 56, maxX: 100, distance: 44, progress: 0.01, jumps: 0, coins: 0 });
    expect(w.runs[0].modelRevision).toBe(w.revision);
    expect(w.runs[0].codeVersion).toBe(2);
  });
});

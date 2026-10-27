// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { MarioController } from "./controller";
import type { MarioHooks } from "./controller";
import { starterModel } from "./starter";
import { initModel } from "../nn/network";

/*
 * Runs the REAL legacy game scripts (public/game/mario/js) in a vm with a stubbed DOM/canvas/audio, then drives
 * them through the same adapter (window.__marioHooks) the React wrapper uses. No physics is reimplemented.
 */
const JS_DIR = path.join(process.cwd(), "public/game/mario/js");
const FILES = [
  "util.js", "input.js", "resources.js", "sprite.js", "entity.js", "pipe.js", "mushroom.js", "fireflower.js", "star.js", "fireball.js",
  "coin.js", "bcoin.js", "goomba.js", "koopa.js", "floor.js", "block.js", "rubble.js", "prop.js", "player.js", "flag.js",
  "levels/level.js", "levels/11.js", "levels/11tunnel.js", "game.js",
];

function loadGame() {
  const noop = () => undefined;
  const ctx: unknown = new Proxy({}, { get: (_t, k) => (k === "canvas" ? {} : noop), set: () => true });
  const frames: (() => void)[] = [];
  class FakeAudio {
    currentTime = 0;
    play() { return Promise.resolve(); }
    pause() {}
  }
  class FakeImage {
    onload: (() => void) | null = null;
    width = 16;
    height = 16;
    set src(_v: string) { queueMicrotask(() => this.onload?.()); }
  }
  const canvas = { width: 0, height: 0, getContext: () => ctx, parentNode: null };
  const win: Record<string, unknown> = {};
  const sandbox: Record<string, unknown> = {
    window: win,
    document: { createElement: () => canvas, addEventListener: noop, removeEventListener: noop },
    Audio: FakeAudio,
    Image: FakeImage,
    setTimeout: noop,
    clearTimeout: noop,
    Date,
    Math,
    console,
  };
  win.requestAnimationFrame = (cb: () => void) => frames.push(cb);
  win.cancelAnimationFrame = noop;
  win.clearTimeout = noop;
  win.addEventListener = noop;
  win.removeEventListener = noop;
  win.__marioGameHost = { appendChild: noop };
  Object.assign(sandbox, win);
  sandbox.window = sandbox; // scripts treat `window` as the global object
  sandbox.requestAnimationFrame = win.requestAnimationFrame;
  sandbox.cancelAnimationFrame = noop;
  sandbox.addEventListener = noop;
  sandbox.removeEventListener = noop;
  sandbox.__marioGameHost = win.__marioGameHost;
  const context = vm.createContext(sandbox);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(JS_DIR, f), "utf8"), context, { filename: f });
  return { sandbox, frames };
}

async function boot() {
  const g = loadGame();
  await Promise.resolve();
  await Promise.resolve();
  const step = (n: number) => {
    for (let i = 0; i < n; i++) {
      const cb = g.frames.shift();
      if (!cb) throw new Error("game loop stopped");
      cb();
    }
  };
  const hooks = g.sandbox.__marioHooks as MarioHooks;
  return { hooks, step, g };
}

describe("controller against the real game scripts", () => {
  it("exposes a real snapshot of the loaded level", async () => {
    const { hooks, step } = await boot();
    step(3);
    const s = hooks.snapshot();
    expect(s.player.x).toBeGreaterThanOrEqual(56);
    expect(s.player.standing).toBe(true);
    expect(s.levelExitX).toBe(204 * 16);
    expect(s.isSolid(0, 13)).toBe(true); // floor at the start
    expect(s.enemies.length).toBeGreaterThan(10);
  });

  it("network mode moves Mario right through the real physics; human mode with no keys does not", async () => {
    const a = await boot();
    a.step(120);
    const idle = a.hooks.snapshot().player.x;

    const b = await boot();
    const c = new MarioController({ hooks: b.hooks, getModel: () => ({ model: starterModel(), revision: 1 }) });
    c.attach();
    c.setMode("network");
    b.step(120);
    expect(b.hooks.snapshot().player.x).toBeGreaterThan(idle + 50);
    c.detach();
    expect(b.hooks.keys).toBeNull();
  });

  it("pause stops the simulation and reset restarts the level", async () => {
    const { hooks, step } = await boot();
    const c = new MarioController({ hooks, getModel: () => ({ model: starterModel(), revision: 1 }) });
    c.attach();
    c.setMode("network");
    step(60);
    const x = hooks.snapshot().player.x;
    hooks.paused = true;
    step(30);
    expect(hooks.snapshot().player.x).toBe(x);
    hooks.paused = false;
    hooks.reset();
    console.log('after reset', hooks.snapshot().player.x, hooks.snapshot().viewportX);
    step(1);
    console.log('after step', JSON.stringify(hooks.snapshot().player), hooks.keys);
    expect(hooks.snapshot().player.x).toBeLessThan(x);
    expect(hooks.snapshot().frame).toBe(1);
  });

  it("is deterministic: the same model produces the same trajectory", async () => {
    const run = async () => {
      const { hooks, step } = await boot();
      const c = new MarioController({ hooks, getModel: () => ({ model: starterModel(), revision: 1 }) });
      c.attach();
      c.setMode("network");
      step(400);
      const p = hooks.snapshot().player;
      return [p.x, p.y, p.dying];
    };
    expect(await run()).toEqual(await run());
  });

  it("editing a weight changes the real trajectory", async () => {
    const dist = async (model: ReturnType<typeof starterModel>) => {
      const { hooks, step } = await boot();
      const c = new MarioController({ hooks, getModel: () => ({ model, revision: 1 }) });
      c.attach();
      c.setMode("network");
      step(200);
      return hooks.snapshot().player.x;
    };
    const base = starterModel();
    const stopped = starterModel();
    stopped.layers[1].weights[0][4] = 0; // run score 0 -> wait wins (0.1)
    expect(await dist(stopped)).toBeLessThan(await dist(base));
    expect(initModel(5, [{ size: 3, activation: "linear" }], 1).layers).toHaveLength(1);
  });
});

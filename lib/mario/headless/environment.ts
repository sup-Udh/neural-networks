import type { MarioHooks } from "../controller";

/*
 * Boots the REAL legacy Mario scripts without a page: the scripts only need a handful of browser globals, which
 * are stubbed here (a no-op canvas context, silent Audio, an Image that "loads" immediately, no timers and no
 * animation loop). No physics is reimplemented. The same loader works in a Web Worker (scripts evaluated in the
 * worker's own global scope, fully separate from the visible game) and in a Node `vm` context (tests).
 */

type Globals = Record<string, unknown>;

/** Installs the browser stubs the scripts expect onto `g` (a worker global or a vm sandbox). */
export function installBrowserStubs(g: Globals): void {
  const noop = () => undefined;
  // The scripts only call clearRect, fillRect, drawImage and scale on the context (and set fillStyle); a plain object
  // is much cheaper per frame than a Proxy, which matters because render() runs every simulated frame.
  const ctx = { canvas: {}, fillStyle: "", clearRect: noop, fillRect: noop, drawImage: noop, scale: noop };
  class SilentAudio {
    currentTime = 0;
    play() {
      return Promise.resolve();
    }
    pause() {}
  }
  class InstantImage {
    onload: (() => void) | null = null;
    width = 16;
    height = 16;
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  g.window = g;
  g.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx, parentNode: null }),
    addEventListener: noop,
    removeEventListener: noop,
  };
  g.Audio = SilentAudio;
  g.Image = InstantImage;
  g.__marioGameHost = { appendChild: noop };
  // The headless host drives frames itself through __marioHooks.step, so no animation loop is ever scheduled.
  g.requestAnimationFrame = () => 0;
  g.cancelAnimationFrame = noop;
  // Timers are disabled on purpose: a stale setTimeout (e.g. the post-flag level reload) must never fire into a later episode.
  g.setTimeout = () => 0;
  g.clearTimeout = noop;
  // A real worker global already has working addEventListener/removeEventListener; only fill them in for sandboxes.
  g.addEventListener ??= noop;
  g.removeEventListener ??= noop;
}

/**
 * Installs stubs on `g`, runs each script source in order through `run` (which must evaluate in `g`'s global
 * scope), waits for the stubbed images to "load", and returns the game's hooks.
 */
export async function bootHeadlessGame(g: Globals, sources: { name: string; code: string }[], run: (code: string, name: string) => void): Promise<MarioHooks> {
  installBrowserStubs(g);
  for (const s of sources) run(s.code, s.name);
  // resources.onReady -> init() runs after the Image stubs fire in a microtask.
  for (let i = 0; i < 5; i++) await Promise.resolve();
  const hooks = g.__marioHooks as MarioHooks | undefined;
  if (!hooks) throw new Error("The Mario scripts loaded but did not create window.__marioHooks.");
  hooks.snapshot(); // throws if the level was never initialised
  return hooks;
}

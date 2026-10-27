/*
 * Runs learner policy code (plain JavaScript, no types) in a Web Worker.
 *
 * What is enforced: the worker has no DOM and no access to application state; fetch/XMLHttpRequest/WebSocket/
 * importScripts/postMessage/self/globalThis are shadowed inside the policy's scope; the main thread only accepts
 * a reply that is exactly one of "run" | "jump" | "wait"; a watchdog terminates a worker that does not answer
 * within `timeoutMs`, so an infinite loop cannot freeze the page.
 * What is NOT claimed: a worker is not a hardened security boundary (code can still reach globals the shadow
 * list misses, e.g. via constructors). This suits a single-user learning tool, not untrusted multi-user code.
 * No imports, network, or filesystem are offered by the API. Code is plain JS: type annotations are not compiled.
 */

import { isMarioAction } from "./actions";
import type { MarioAction } from "./actions";
import type { PolicyRunner } from "./controller";

const WORKER_SOURCE = `
let decideFn = null;
const shadow = ["console", "fetch", "XMLHttpRequest", "WebSocket", "importScripts", "postMessage", "self", "globalThis"];
self.onmessage = (event) => {
  const msg = event.data;
  if (msg.type === "load") {
    try {
      const noop = { log() {} };
      const factory = new Function(...shadow, '"use strict";\\n' + msg.code + '\\n;return typeof decide === "function" ? decide : undefined;');
      decideFn = factory(noop);
      if (typeof decideFn !== "function") throw new Error("Define a function named decide(obs).");
      postMessage({ type: "loaded", ok: true });
    } catch (e) {
      postMessage({ type: "loaded", ok: false, error: (e && e.name ? e.name + ": " : "") + (e && e.message ? e.message : String(e)) });
    }
  } else if (msg.type === "decide") {
    try {
      postMessage({ type: "decision", id: msg.id, ok: true, value: decideFn(msg.obs) });
    } catch (e) {
      postMessage({ type: "decision", id: msg.id, ok: false, error: (e && e.name ? e.name + ": " : "") + (e && e.message ? e.message : String(e)) });
    }
  }
};`;

type Obs = Parameters<PolicyRunner["decide"]>[0];
const wire = ({ observation, scores }: Obs) => ({ raw: observation.raw, inputs: observation.inputs, scores });

function makeWorker(): { worker: Worker; dispose: () => void } {
  const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
  const worker = new Worker(url);
  return {
    worker,
    dispose: () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    },
  };
}

export const SAMPLE_OBSERVATION: Obs = {
  observation: {
    available: true,
    inputs: [0, 0, 0, 0, 1],
    raw: { frame: 0, obstacleDistancePx: null, pitDistancePx: null, enemyDistancePx: null, horizontalVelocity: 0, verticalVelocity: 0, isGrounded: true, x: 56, y: 192 },
  },
  scores: [0.6, 0, 0.1],
};

export type PolicyCheck = { ok: true; action: MarioAction } | { ok: false; error: string };

/** Compiles the code in a throw-away worker and runs it once on a sample observation. */
export function validatePolicy(code: string, timeoutMs = 1000): Promise<PolicyCheck> {
  if (typeof Worker === "undefined") return Promise.resolve({ ok: false, error: "Web Workers are unavailable in this browser." });
  return new Promise((resolve) => {
    const { worker, dispose } = makeWorker();
    const finish = (r: PolicyCheck) => {
      window.clearTimeout(timer);
      dispose();
      resolve(r);
    };
    const timer = window.setTimeout(() => finish({ ok: false, error: `No answer within ${timeoutMs} ms. The code may contain an infinite loop.` }), timeoutMs);
    worker.onerror = (e) => {
      e.preventDefault();
      finish({ ok: false, error: e.message || "The code could not be loaded." });
    };
    worker.onmessage = (event: MessageEvent) => {
      const m = event.data;
      if (m.type === "loaded") {
        if (!m.ok) finish({ ok: false, error: m.error });
        else worker.postMessage({ type: "decide", id: 0, obs: wire(SAMPLE_OBSERVATION) });
      } else if (m.type === "decision") {
        if (!m.ok) finish({ ok: false, error: m.error });
        else if (!isMarioAction(m.value)) finish({ ok: false, error: `decide() must return "run", "jump" or "wait" but returned ${JSON.stringify(m.value) ?? String(m.value)}.` });
        else finish({ ok: true, action: m.value });
      }
    };
    worker.postMessage({ type: "load", code });
  });
}

/**
 * Long-lived worker used while the game runs. `decide` never blocks: it sends the newest frame when the worker
 * is idle and returns the last validated answer, so the policy's answer lags the game by about one frame.
 */
export class WorkerPolicy implements PolicyRunner {
  private handle = makeWorker();
  private loaded = false;
  private pendingSince: number | null = null;
  private nextId = 1;
  private latest: MarioAction | null = null;
  private error: string | null = null;
  private disposed = false;

  constructor(code: string, private timeoutMs = 250) {
    this.handle.worker.onmessage = (event: MessageEvent) => {
      const m = event.data;
      if (m.type === "loaded") {
        this.loaded = m.ok;
        if (!m.ok) this.error = m.error;
      } else if (m.type === "decision") {
        this.pendingSince = null;
        if (!m.ok) this.error = m.error;
        else if (!isMarioAction(m.value)) this.error = `decide() returned ${JSON.stringify(m.value) ?? String(m.value)}, not "run", "jump" or "wait"`;
        else {
          this.latest = m.value;
          this.error = null;
        }
      }
    };
    this.handle.worker.onerror = (e) => {
      e.preventDefault();
      this.error = e.message || "The policy worker crashed";
    };
    this.handle.worker.postMessage({ type: "load", code });
  }

  decide(input: Obs) {
    if (this.disposed) return { action: null, error: "Policy was disposed" };
    if (this.pendingSince !== null && performance.now() - this.pendingSince > this.timeoutMs) {
      this.error = `decide() did not answer within ${this.timeoutMs} ms (possible infinite loop); the policy was stopped`;
      this.dispose();
      return { action: null, error: this.error };
    }
    if (this.loaded && this.pendingSince === null) {
      this.pendingSince = performance.now();
      this.handle.worker.postMessage({ type: "decide", id: this.nextId++, obs: wire(input) });
    }
    return { action: this.error ? null : this.latest, error: this.error };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.handle.dispose();
  }
}

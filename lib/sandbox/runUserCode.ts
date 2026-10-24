/*
 * Runs learner code in a throw-away Web Worker.
 *
 * Isolation: a worker has no DOM, no cookies and no access to React or application state. Network and messaging
 * globals are shadowed inside the function scope, and a watchdog terminates the worker after `timeoutMs`, so an
 * infinite loop cannot freeze the page. Limitation: this is not a hardened security boundary (a worker can still
 * reach globals the shadow list misses), so it suits a single-user learning tool, not untrusted multi-tenant code.
 */

export interface RunResult {
  ok: boolean;
  value: number | null;
  logs: string[];
  error: string | null;
  timedOut: boolean;
  ms: number;
}

const WORKER_SOURCE = `
const post = self.postMessage.bind(self);
self.onmessage = (event) => {
  const { code, args } = event.data;
  const logs = [];
  const show = (v) => { if (typeof v === "string") return v; try { return JSON.stringify(v) ?? String(v); } catch { return String(v); } };
  const sandboxConsole = { log: (...a) => { if (logs.length < 50) logs.push(a.map(show).join(" ")); } };
  try {
    const body = '"use strict";\\n' + code + '\\n;return typeof neuron === "function" ? neuron : undefined;';
    const factory = new Function("console", "fetch", "XMLHttpRequest", "WebSocket", "importScripts", "postMessage", "self", "globalThis", body);
    const fn = factory(sandboxConsole);
    if (typeof fn !== "function") throw new Error("Define a function named neuron(x1, x2, w1, w2, bias).");
    const value = fn(...args);
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("neuron() must return a finite number, but it returned " + show(value) + ".");
    post({ ok: true, value, logs });
  } catch (error) {
    post({ ok: false, error: (error && error.name ? error.name + ": " : "") + (error && error.message ? error.message : String(error)), logs });
  }
};`;

export function runUserCode(code: string, args: number[], timeoutMs = 1500): Promise<RunResult> {
  const started = performance.now();
  const finish = (partial: Partial<RunResult>): RunResult => ({
    ok: false, value: null, logs: [], error: null, timedOut: false, ms: Math.round(performance.now() - started), ...partial,
  });
  if (typeof Worker === "undefined") return Promise.resolve(finish({ error: "This browser cannot run the code sandbox (Web Workers are unavailable)." }));

  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
    const worker = new Worker(url);
    const done = (result: RunResult) => {
      window.clearTimeout(watchdog);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(result);
    };
    const watchdog = window.setTimeout(
      () => done(finish({ timedOut: true, error: `Stopped after ${timeoutMs} ms. Your code may contain an infinite loop.` })),
      timeoutMs,
    );
    worker.onmessage = (event: MessageEvent<{ ok: boolean; value?: number; logs: string[]; error?: string }>) => {
      const { ok, value, logs, error } = event.data;
      done(finish({ ok, value: ok ? (value ?? null) : null, logs, error: ok ? null : (error ?? "Unknown error") }));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      done(finish({ error: event.message || "The code could not be loaded." }));
    };
    worker.postMessage({ code, args });
  });
}

/// <reference lib="webworker" />
/*
 * Web Worker that owns a private copy of the REAL Mario scripts (evaluated in this worker's own global scope, so it
 * shares nothing with the visible game on the page) and runs evaluation episodes on request.
 */
import { HeadlessEvaluator } from "../evaluation";
import { bootHeadlessGame } from "./environment";
import type { FromWorker, ToWorker } from "./protocol";

const scope = self as unknown as DedicatedWorkerGlobalScope & Record<string, unknown>;
const send = (m: FromWorker) => scope.postMessage(m);
let evaluator: HeadlessEvaluator | null = null;

scope.onmessage = async (event: MessageEvent<ToWorker>) => {
  const msg = event.data;
  try {
    if (msg.type === "init") {
      const sources = await Promise.all(
        msg.scripts.map(async (name) => {
          const res = await fetch(msg.scriptBase + name);
          if (!res.ok) throw new Error(`Could not load ${name} (${res.status}).`);
          return { name, code: await res.text() };
        }),
      );
      // Indirect eval runs each script in the worker's global scope, like a classic <script> tag.
      const hooks = await bootHeadlessGame(scope, sources, (code) => {
        (0, eval)(code);
      });
      evaluator = new HeadlessEvaluator(hooks);
      send({ type: "ready" });
    } else if (msg.type === "evaluate") {
      if (!evaluator) throw new Error("The evaluator is not ready yet.");
      send({ type: "result", id: msg.id, result: evaluator.evaluateSync(msg.model, msg.config, msg.episodeId) });
    }
  } catch (error) {
    send({ type: "error", id: msg.type === "evaluate" ? msg.id : null, message: error instanceof Error ? error.message : String(error) });
  }
};

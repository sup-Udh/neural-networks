import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import type { MarioHooks } from "../controller";
import { LEGACY_SCRIPTS } from "../gameScripts";
import { bootHeadlessGame } from "./environment";

/** Node-only: boots a fresh, fully isolated copy of the real game scripts in a vm context (used by tests and tools). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function bootGameInVm(root = process.cwd()): Promise<MarioHooks & { global: Record<string, any> }> {
  const dir = path.join(root, "public/game/mario/js");
  const sandbox: Record<string, unknown> = { Date, Math, console };
  const context = vm.createContext(sandbox);
  const sources = LEGACY_SCRIPTS.map((name) => ({ name, code: fs.readFileSync(path.join(dir, name), "utf8") }));
  const hooks = await bootHeadlessGame(sandbox, sources, (code, name) => {
    vm.runInContext(code, context, { filename: name });
  });
  // `global` exposes the game's globals (player, level, ...) so tests can stage situations the real code then reacts to.
  return Object.assign(hooks, { global: sandbox });
}

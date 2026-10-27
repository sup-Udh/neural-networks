// @vitest-environment node
import fs from "node:fs";
import { it } from "vitest";
import { DEFAULT_EVAL_CONFIG, HeadlessEvaluator, captureSceneSync } from "./evaluation";
import { DEFAULT_TRAINING_CONFIG } from "./evolution";
import { InProcessEvaluator } from "./headless/workerEvaluator";
import { bootGameInVm } from "./headless/vmLoader";
import { starterModel } from "./starter";
import { Trainer } from "./trainer";
import { evaluateJob } from "./validation";
import { compareSummaries } from "./summary";

it("scratch", async () => {
  const hooks = await bootGameInVm();
  const core = new HeadlessEvaluator(hooks);
  const ev = new InProcessEvaluator(hooks);
  const out: string[] = [];
  const scene = captureSceneSync(core, starterModel(), DEFAULT_EVAL_CONFIG, 850);
  out.push("SCENE " + JSON.stringify(scene));
  const base = await evaluateJob(ev, { label: "starter", model: starterModel(), role: "matched" }, DEFAULT_EVAL_CONFIG, "t");
  out.push("STARTER matched " + JSON.stringify(base.episodes.map((e) => [e.scenarioId.slice(-3), e.termination, Math.round(e.distance), e.frames, Math.round(e.fitness)])));
  out.push("STARTER summary " + JSON.stringify(base.summary));
  const t0 = Date.now();
  const s = await new Trainer(ev, { ...DEFAULT_TRAINING_CONFIG, generations: 4 }, starterModel(), "Starter", () => undefined).run();
  out.push(`TRAIN ${((Date.now() - t0) / 1000).toFixed(0)}s best per gen ` + JSON.stringify(s.generations.map((g) => [Math.round(g.best!.fitness), g.best!.candidateId, g.best!.termination])));
  out.push("baseline " + JSON.stringify(s.baseline) + " globalBest " + JSON.stringify({ ...s.globalBest, model: undefined }));
  const best = await evaluateJob(ev, { label: "best", model: s.globalBest!.model, role: "matched" }, DEFAULT_EVAL_CONFIG, "t2");
  out.push("BEST matched " + JSON.stringify(best.episodes.map((e) => [e.scenarioId.slice(-3), e.termination, Math.round(e.distance), e.frames, Math.round(e.fitness)])));
  out.push("BEST summary " + JSON.stringify(best.summary));
  out.push("VERDICT " + JSON.stringify(compareSummaries(base, best)));
  fs.writeFileSync(process.env.TEMP + "/scratch3.txt", out.join("\n"));
}, 300_000);

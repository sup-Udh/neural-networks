import { modelHash } from "../nn/compare";
import type { NetworkModel } from "../nn/network";
import { starterModel } from "./starter";
import { originFromBasedOn } from "./workspace";
import type { ModelOrigin, Provenance, Workspace } from "./workspace";

/** Anything that can be compared, evaluated or promoted, with where it came from (never guessed). */
export interface ModelSource {
  id: string;
  label: string;
  origin: ModelOrigin;
  model: NetworkModel;
  hash: string;
  /** Where an evolved model came from; null when unknown (e.g. saved before provenance tracking). */
  provenance: Provenance | null;
  /** Free-text origin detail shown in the UI. */
  detail: string;
}

export const ORIGIN_LABEL: Record<ModelOrigin, string> = {
  starter: "starter (hand-set)",
  "manual-edit": "manual edit",
  evolved: "evolved candidate",
  unknown: "unknown origin",
};

export function buildModelSources(ws: Workspace): ModelSource[] {
  const out: ModelSource[] = [];
  const add = (s: Omit<ModelSource, "hash">) => out.push({ ...s, hash: modelHash(s.model) });
  const starter = starterModel();
  add({ id: "starter", label: "Starter model", origin: "starter", model: starter, provenance: null, detail: "The hand-set baseline shipped with the lab." });
  add({
    id: "active",
    label: `Active model (rev ${ws.revision})`,
    origin: originFromBasedOn(ws.basedOn, ws.snapshots),
    model: ws.model,
    provenance: null,
    detail: ws.basedOn ? `Last based on “${ws.basedOn}”.` : "Edited by hand since it was last based on a saved model.",
  });
  for (const s of ws.snapshots) {
    add({ id: `snap:${s.id}`, label: `Snapshot: ${s.name}`, origin: s.origin ?? "unknown", model: s.model, provenance: s.provenance ?? null, detail: s.origin ? `Saved ${new Date(s.createdAt).toLocaleString()}.` : "Saved before origin tracking, so its origin is unknown." });
  }
  for (const t of ws.trainings) {
    const tag = new Date(t.createdAt).toLocaleTimeString();
    add({ id: `base:${t.id}`, label: `Training ${tag}: start model`, origin: t.startLabel.startsWith("Starter") ? "starter" : "unknown", model: t.startModel, provenance: null, detail: `Baseline of the session started from ${t.startLabel}.` });
    if (t.globalBest) {
      const b = t.globalBest;
      add({
        id: `best:${t.id}`,
        label: `Training ${tag}: best (${b.candidateId})`,
        origin: "evolved",
        model: b.model,
        provenance: { sessionId: t.id, candidateId: b.candidateId, generation: b.generation },
        detail: `Generation ${b.generation + 1}${b.origin ? `, ${b.origin}` : ""}${b.parentId ? `, parent ${b.parentId}` : ", parent unknown"}.`,
      });
    }
  }
  return out;
}

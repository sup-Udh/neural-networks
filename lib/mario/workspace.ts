import { createPersistedStore } from "../storage/persisted";
import { cloneModel, parseModel, withActivation, withBias, withWeight } from "../nn/network";
import type { ActivationName, NetworkModel } from "../nn/network";
import type { EpisodeMetrics } from "./episode";
import { INPUT_SCHEMA_VERSION } from "./observation";
import { STARTER_POLICY_CODE, starterModel } from "./starter";
import type { TrainingSession } from "./trainer";
import type { EvaluationRecord } from "./validation";

/*
 * The single canonical workspace: one active model, the code, saved snapshots and run records.
 * Every update returns a NEW state object (no in-place mutation) so subscribers re-render and saved
 * snapshots can never be corrupted by later edits (snapshots hold deep copies).
 */

export type ModelOrigin = "starter" | "manual-edit" | "evolved" | "unknown";

export interface Provenance {
  sessionId: string;
  candidateId: string;
  generation: number;
}

export interface Snapshot {
  id: string;
  name: string;
  createdAt: number;
  model: NetworkModel;
  policyCode: string;
  /** Absent on snapshots saved before origin tracking; shown as "unknown", never guessed. */
  origin?: ModelOrigin;
  provenance?: Provenance | null;
}

export interface ChallengeProgress {
  completedAt: number;
  /** What the user actually did, e.g. "predicted jump, observed run". */
  detail: string;
}

export interface RunRecord {
  id: string;
  createdAt: number;
  mode: "network" | "policy" | "human";
  /** "rev N" plus the snapshot name when the model was identical to that snapshot at run start. */
  label: string;
  modelRevision: number;
  model: NetworkModel;
  codeVersion: number;
  inputSchemaVersion: number;
  metrics: EpisodeMetrics;
}

export interface Workspace {
  model: NetworkModel;
  /** Increments on every parameter or activation change, reset or restore. */
  revision: number;
  /** Name of the snapshot this model was restored from or saved as, until the next edit. */
  basedOn: string | null;
  draftCode: string;
  activeCode: string;
  codeVersion: number;
  snapshots: Snapshot[];
  runs: RunRecord[];
  /** Completed, cancelled and failed training sessions (newest first). */
  trainings: TrainingSession[];
  /** Measured evaluations (development/validation/matched), newest first, keyed to models by content hash. */
  evaluations: EvaluationRecord[];
  /** Guided challenges the user has genuinely completed. */
  challenges: Record<string, ChallengeProgress>;
  /** Problems found while loading saved data (records that could not be read). Cleared by dismissNotices. */
  notices: string[];
}

export const MAX_TRAININGS = 5;
export const MAX_EVALUATIONS = 60;

const MAX_RUNS = 40;

export const initialWorkspace = (): Workspace => ({
  model: starterModel(),
  revision: 1,
  basedOn: "Starter",
  draftCode: STARTER_POLICY_CODE,
  activeCode: STARTER_POLICY_CODE,
  codeVersion: 1,
  snapshots: [],
  runs: [],
  trainings: [],
  evaluations: [],
  challenges: {},
  notices: [],
});

let idCounter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

export type Result = { ok: true } | { ok: false; error: string };

export function editWeight(w: Workspace, layer: number, neuron: number, input: number, value: number): Workspace {
  return { ...w, model: withWeight(w.model, layer, neuron, input, value), revision: w.revision + 1, basedOn: null };
}
export function editBias(w: Workspace, layer: number, neuron: number, value: number): Workspace {
  return { ...w, model: withBias(w.model, layer, neuron, value), revision: w.revision + 1, basedOn: null };
}
export function editActivation(w: Workspace, layer: number, activation: ActivationName): Workspace {
  return { ...w, model: withActivation(w.model, layer, activation), revision: w.revision + 1, basedOn: null };
}
export function resetModel(w: Workspace): Workspace {
  return { ...w, model: starterModel(), revision: w.revision + 1, basedOn: "Starter" };
}
/** Origin of the active model, from what it was last based on (null = edited by hand since). */
export function originFromBasedOn(basedOn: string | null, snapshots: readonly Snapshot[]): ModelOrigin {
  if (basedOn === null) return "manual-edit";
  if (basedOn === "Starter") return "starter";
  if (basedOn.startsWith("Trained")) return "evolved";
  return snapshots.find((x) => x.name === basedOn)?.origin ?? "unknown";
}

export function saveSnapshot(w: Workspace, name: string): Workspace {
  const trimmed = name.trim() || `Snapshot ${w.snapshots.length + 1}`;
  const origin = originFromBasedOn(w.basedOn, w.snapshots);
  const snap: Snapshot = { id: newId("snap"), name: trimmed, createdAt: Date.now(), model: cloneModel(w.model), policyCode: w.activeCode, origin, provenance: null };
  return { ...w, snapshots: [...w.snapshots, snap], basedOn: trimmed };
}
/** Saves an arbitrary model (e.g. a trained candidate) as a snapshot without changing the active model. */
export function addSnapshot(w: Workspace, name: string, model: NetworkModel, origin: ModelOrigin = "unknown", provenance: Provenance | null = null): Workspace {
  const snap: Snapshot = { id: newId("snap"), name: name.trim() || `Snapshot ${w.snapshots.length + 1}`, createdAt: Date.now(), model: cloneModel(model), policyCode: w.activeCode, origin, provenance };
  return { ...w, snapshots: [...w.snapshots, snap] };
}
export function restoreSnapshot(w: Workspace, id: string): Workspace {
  const snap = w.snapshots.find((s) => s.id === id);
  if (!snap) throw new Error("That snapshot no longer exists.");
  return { ...w, model: cloneModel(snap.model), revision: w.revision + 1, basedOn: snap.name, draftCode: snap.policyCode, activeCode: snap.policyCode, codeVersion: w.codeVersion + 1 };
}
export function deleteSnapshot(w: Workspace, id: string): Workspace {
  return { ...w, snapshots: w.snapshots.filter((s) => s.id !== id) };
}
export function setDraftCode(w: Workspace, code: string): Workspace {
  return { ...w, draftCode: code };
}
export function applyCode(w: Workspace): Workspace {
  return { ...w, activeCode: w.draftCode, codeVersion: w.codeVersion + 1 };
}
export function resetCode(w: Workspace): Workspace {
  return { ...w, draftCode: STARTER_POLICY_CODE };
}
export function recordRun(w: Workspace, mode: RunRecord["mode"], metrics: EpisodeMetrics): Workspace {
  const run: RunRecord = {
    id: newId("run"),
    createdAt: Date.now(),
    mode,
    label: `rev ${w.revision}${w.basedOn ? ` · ${w.basedOn}` : " · edited"}`,
    modelRevision: w.revision,
    model: cloneModel(w.model),
    codeVersion: w.codeVersion,
    inputSchemaVersion: INPUT_SCHEMA_VERSION,
    metrics,
  };
  return { ...w, runs: [run, ...w.runs].slice(0, MAX_RUNS) };
}

/** Replaces the active model with a trained candidate. The previous model is kept only if the caller saved it. */
export function promoteModel(w: Workspace, model: NetworkModel, label: string): Workspace {
  return { ...w, model: cloneModel(model), revision: w.revision + 1, basedOn: label };
}
export function recordTraining(w: Workspace, session: TrainingSession): Workspace {
  const rest = w.trainings.filter((t) => t.id !== session.id);
  return { ...w, trainings: [structuredClone(session), ...rest].slice(0, MAX_TRAININGS) };
}
export function deleteTraining(w: Workspace, id: string): Workspace {
  return { ...w, trainings: w.trainings.filter((t) => t.id !== id) };
}
export function recordEvaluations(w: Workspace, records: EvaluationRecord[]): Workspace {
  return { ...w, evaluations: [...records, ...w.evaluations].slice(0, MAX_EVALUATIONS) };
}
export function completeChallenge(w: Workspace, id: string, detail: string): Workspace {
  if (w.challenges[id]) return w;
  return { ...w, challenges: { ...w.challenges, [id]: { completedAt: Date.now(), detail } } };
}
export function dismissNotices(w: Workspace): Workspace {
  return { ...w, notices: [] };
}

export interface ParamDiff {
  where: string;
  a: number | string;
  b: number | string;
}

/** Lists every parameter that differs between two models of the same shape. */
export function diffModels(a: NetworkModel, b: NetworkModel): ParamDiff[] {
  const out: ParamDiff[] = [];
  a.layers.forEach((la, l) => {
    const lb = b.layers[l];
    if (!lb) return;
    if (la.activation !== lb.activation) out.push({ where: `L${l + 1} activation`, a: la.activation, b: lb.activation });
    la.weights.forEach((row, j) =>
      row.forEach((w, i) => {
        const other = lb.weights[j]?.[i];
        if (other !== undefined && other !== w) out.push({ where: `L${l + 1} n${j + 1} w${i + 1}`, a: w, b: other });
      }),
    );
    la.biases.forEach((bias, j) => {
      const other = lb.biases[j];
      if (other !== undefined && other !== bias) out.push({ where: `L${l + 1} n${j + 1} bias`, a: bias, b: other });
    });
  });
  return out;
}

function parseBest(b: unknown): TrainingSession["globalBest"] {
  if (!b || typeof b !== "object") return null;
  const r = b as NonNullable<TrainingSession["globalBest"]>;
  const m = parseModel(r.model);
  return m && typeof r.fitness === "number" && typeof r.candidateId === "string" ? { ...r, model: m } : null;
}

function parseTraining(t: unknown): TrainingSession | null {
  if (!t || typeof t !== "object") return null;
  const r = t as TrainingSession;
  const start = parseModel(r.startModel);
  if (!start || typeof r.id !== "string" || !r.config || !Array.isArray(r.generations)) return null;
  const generations = r.generations.map((g) => (g && typeof g === "object" ? { ...g, best: parseBest(g.best) } : null));
  if (generations.some((g) => !g)) return null;
  return { ...r, startModel: start, generations: generations as TrainingSession["generations"], globalBest: parseBest(r.globalBest) };
}

function parseWorkspace(data: unknown): Workspace | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Partial<Workspace>;
  const model = parseModel(d.model);
  if (!model || typeof d.draftCode !== "string" || typeof d.activeCode !== "string") return null;
  const notices: string[] = [];
  const snapshots = (Array.isArray(d.snapshots) ? d.snapshots : []).flatMap((s): Snapshot[] => {
    const m = parseModel(s?.model);
    if (m && typeof s.id === "string" && typeof s.name === "string") return [{ id: s.id, name: s.name, createdAt: Number(s.createdAt) || 0, model: m, policyCode: String(s.policyCode ?? ""), origin: s.origin, provenance: s.provenance ?? null }];
    notices.push(`A saved snapshot${typeof s?.name === "string" ? ` (“${s.name}”)` : ""} could not be read and was skipped.`);
    return [];
  });
  const runs = (Array.isArray(d.runs) ? d.runs : []).flatMap((r): RunRecord[] => {
    const m = parseModel(r?.model);
    if (m && r.metrics && typeof r.id === "string") return [{ ...r, model: m }];
    notices.push("A saved run record could not be read and was skipped.");
    return [];
  });
  const trainings = (Array.isArray(d.trainings) ? d.trainings : []).flatMap((t): TrainingSession[] => {
    const parsed = parseTraining(t);
    if (parsed) return [parsed];
    notices.push("A saved training session is incompatible or damaged and was skipped.");
    return [];
  });
  const evaluations = (Array.isArray(d.evaluations) ? d.evaluations : []).flatMap((e): EvaluationRecord[] => {
    if (e && typeof e.id === "string" && typeof e.modelHash === "string" && Array.isArray(e.episodes) && e.summary && typeof e.summary === "object") return [e];
    notices.push("A saved evaluation record could not be read and was skipped.");
    return [];
  });
  const challenges: Record<string, ChallengeProgress> = {};
  if (d.challenges && typeof d.challenges === "object") {
    for (const [k, v] of Object.entries(d.challenges)) {
      if (v && typeof v.completedAt === "number" && typeof v.detail === "string") challenges[k] = v;
      else notices.push(`Saved progress for challenge “${k}” could not be read and was skipped.`);
    }
  }
  return {
    model,
    revision: Number(d.revision) || 1,
    basedOn: typeof d.basedOn === "string" ? d.basedOn : null,
    draftCode: d.draftCode,
    activeCode: d.activeCode,
    codeVersion: Number(d.codeVersion) || 1,
    snapshots,
    runs,
    trainings,
    evaluations,
    challenges,
    notices: [...(Array.isArray(d.notices) ? d.notices.filter((n): n is string => typeof n === "string") : []), ...notices],
  };
}

const fallback = initialWorkspace();
/** localStorage-backed (isolated here so it can be swapped for a server store later). */
export const workspaceStore = createPersistedStore<Workspace>("neuralarc.mario.workspace", 1, fallback, parseWorkspace);

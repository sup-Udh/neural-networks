"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DEFAULT_EVAL_CONFIG } from "@/lib/mario/evaluation";
import { DEFAULT_TRAINING_CONFIG, validateTrainingConfig } from "@/lib/mario/evolution";
import type { TrainingConfig } from "@/lib/mario/evolution";
import type { TrainingSession } from "@/lib/mario/trainer";
import { trainingStore } from "@/lib/mario/trainingStore";
import { starterModel } from "@/lib/mario/starter";
import { diffModels } from "@/lib/mario/workspace";
import type { Workspace } from "@/lib/mario/workspace";
import type { NetworkModel } from "@/lib/nn/network";
import FitnessChart from "./FitnessChart";
import NetworkViz from "./NetworkViz";

interface Props {
  ws: Workspace;
  onPromote: (model: NetworkModel, label: string, run: boolean) => void;
  onSaveSnapshot: (name: string, model: NetworkModel) => void;
  onDeleteTraining: (id: string) => void;
  onDismissNotices: () => void;
  storageError: string | null;
}

const FIELDS: { key: keyof Omit<TrainingConfig, "eval" | "tournamentSize">; label: string; step: string; hint: string }[] = [
  { key: "populationSize", label: "Population", step: "1", hint: "4–64 candidates per generation" },
  { key: "generations", label: "Generations", step: "1", hint: "1–100" },
  { key: "mutationRate", label: "Mutation rate", step: "0.05", hint: "chance each weight/bias changes (0–1]" },
  { key: "mutationStrength", label: "Mutation strength", step: "0.05", hint: "std-dev of the change (0–2]" },
  { key: "eliteCount", label: "Elites kept", step: "1", hint: "copied unchanged, at most half the population" },
  { key: "seed", label: "Seed", step: "1", hint: "seeds the evolution choices only" },
];

const secs = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
const useTraining = () => useSyncExternalStore(trainingStore.subscribe, trainingStore.get, trainingStore.get);

export default function TrainingPanel({ ws, onPromote, onSaveSnapshot, onDeleteTraining, onDismissNotices, storageError }: Props) {
  const { session: liveSession, startError } = useTraining();
  const [start, setStart] = useState("starter");
  const [cfg, setCfg] = useState<TrainingConfig>(DEFAULT_TRAINING_CONFIG);
  const [maxFrames, setMaxFrames] = useState(String(DEFAULT_EVAL_CONFIG.maxFrames));
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [genIndex, setGenIndex] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const sessions = useMemo(() => {
    const saved = ws.trainings.filter((t) => t.id !== liveSession?.id);
    return liveSession ? [liveSession, ...saved] : saved;
  }, [ws.trainings, liveSession]);
  const shown: TrainingSession | null = sessions.find((s) => s.id === pickedId) ?? sessions[0] ?? null;
  const running = liveSession !== null && ["initializing", "evaluating", "evolving"].includes(liveSession.state);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const fullCfg: TrainingConfig = { ...cfg, eval: { ...DEFAULT_EVAL_CONFIG, maxFrames: Number(maxFrames) } };
  const errors = validateTrainingConfig(fullCfg);

  const resolveStart = (): { model: NetworkModel; label: string } => {
    if (start === "active") return { model: ws.model, label: `Active model (rev ${ws.revision})` };
    if (start.startsWith("snap:")) {
      const s = ws.snapshots.find((x) => x.id === start.slice(5));
      if (s) return { model: s.model, label: `Snapshot “${s.name}”` };
    }
    return { model: starterModel(), label: "Starter model" };
  };

  const gens = shown?.generations ?? [];
  const gi = genIndex !== null && genIndex < gens.length ? genIndex : gens.length - 1;
  const gen = gi >= 0 ? gens[gi] : null;
  const last = gens.at(-1) ?? null;
  const elapsed = shown ? (shown.finishedAt ?? now) - shown.createdAt : 0;
  const bestName = (g: { candidateId: string; generation: number }) => `${shown?.id.slice(-6)}·${g.candidateId}`;

  return (
    <div className="ml-train">
      {storageError && <p className="ml-error" role="alert">Browser storage is full or blocked, so recent results are NOT saved: {storageError}</p>}
      {ws.notices.length > 0 && (
        <div className="ml-error" role="alert">
          {ws.notices.map((n, i) => <p key={i}>{n}</p>)}
          <button type="button" onClick={onDismissNotices}>Dismiss</button>
        </div>
      )}
      <p className="ml-note">
        Evolution evaluates each candidate network in a real Mario episode (an isolated copy of the game in a Web Worker, so your visible game is untouched),
        keeps the fittest, and mutates them. Fitness = distance in pixels + {DEFAULT_EVAL_CONFIG.fitness.completionBonus} if the flagpole is reached − {DEFAULT_EVAL_CONFIG.fitness.deathPenalty} if Mario dies.
        Nothing is learned unless fitness actually rises in the results below.
      </p>

      <fieldset className="ml-config" disabled={running}>
        <legend>Training run</legend>
        <label className="ml-wide">Start from
          <select value={start} onChange={(e) => setStart(e.target.value)}>
            <option value="starter">Starter model (hand-set baseline)</option>
            <option value="active">Active model (rev {ws.revision})</option>
            {ws.snapshots.map((s) => <option key={s.id} value={`snap:${s.id}`}>Snapshot: {s.name}</option>)}
          </select>
        </label>
        {FIELDS.map((f) => (
          <label key={f.key} title={f.hint}>{f.label}
            <input type="number" step={f.step} value={Number.isNaN(cfg[f.key]) ? "" : cfg[f.key]} onChange={(e) => setCfg({ ...cfg, [f.key]: e.target.value === "" ? NaN : Number(e.target.value) })} />
          </label>
        ))}
        <label title="Frames per episode (60 frames = 1 s of game time)">Frame budget
          <input type="number" step="100" value={maxFrames} onChange={(e) => setMaxFrames(e.target.value)} />
        </label>
      </fieldset>
      {errors.length > 0 && <ul className="ml-error">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      {startError && <p className="ml-error" role="alert">{startError}</p>}

      <div className="ml-row">
        <button type="button" className="is-primary" disabled={running || errors.length > 0} onClick={() => { const s = resolveStart(); trainingStore.start(fullCfg, s.model, s.label); setPickedId(null); setGenIndex(null); }}>
          Start training
        </button>
        <button type="button" disabled={!running} onClick={() => trainingStore.stop()}>Stop</button>
        <button type="button" disabled={running || !liveSession} onClick={() => trainingStore.clear()} title="Hide the finished run (saved sessions are kept)">Clear display</button>
        <span className="ml-badge">{liveSession ? `trainer: ${liveSession.state}` : "trainer: idle"}</span>
      </div>

      {sessions.length > 0 && shown && (
        <>
          <label className="ml-wide">Session
            <select value={shown.id} onChange={(e) => { setPickedId(e.target.value); setGenIndex(null); }}>
              {sessions.map((s) => <option key={s.id} value={s.id}>{new Date(s.createdAt).toLocaleString()} · {s.startLabel} · {s.state} · {s.generations.length}/{s.config.generations} gens</option>)}
            </select>
          </label>
          {shown.error && <p className="ml-error" role="alert">Training {shown.state === "error" ? "failed" : "reported"}: {shown.error}</p>}

          <dl className="ml-metrics">
            <div><dt>State</dt><dd>{shown.state}</dd></div>
            <div><dt>Generation</dt><dd>{Math.min(shown.currentGeneration + (shown.state === "evaluating" ? 1 : 0), shown.config.generations)} / {shown.config.generations}</dd></div>
            <div><dt>Candidate</dt><dd>{shown.state === "evaluating" ? `${shown.currentCandidate + 1} / ${shown.config.populationSize}` : "–"}</dd></div>
            <div><dt>Evaluated</dt><dd>{shown.candidatesEvaluated} ok · {shown.failures} failed</dd></div>
            <div><dt>Best fitness (all-time)</dt><dd>{shown.globalBest ? Math.round(shown.globalBest.fitness) : "–"}</dd></div>
            <div><dt>Latest avg / worst</dt><dd>{last?.avgFitness != null ? `${Math.round(last.avgFitness)} / ${Math.round(last.worstFitness ?? 0)}` : "–"}</dd></div>
            <div><dt>Completion rate (latest)</dt><dd>{last ? `${Math.round(last.completionRate * 100)}%` : "–"}</dd></div>
            <div><dt>Best progress</dt><dd>{shown.globalBest ? `${Math.round(shown.globalBest.progress * 100)}%` : "–"}</dd></div>
            <div><dt>Duration</dt><dd>{secs(elapsed)}</dd></div>
          </dl>

          <FitnessChart generations={gens} selected={gi >= 0 ? gi : null} onSelect={setGenIndex} />

          {gen?.best && (
            <div className="ml-gen">
              <h3>Generation {gi + 1}: best candidate <small>{gen.best.candidateId}</small></h3>
              <p className="ml-note">
                fitness {gen.best.fitness.toFixed(1)} · {gen.best.termination} · distance {Math.round(gen.best.distance)} px · {Math.round(gen.best.progress * 100)}% of the level · {gen.best.frames} frames
                {gen.best.parentId ? ` · bred from ${gen.best.parentId}` : " · the unmodified start model"}.
                Outcomes this generation: {Object.entries(gen.terminations).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(", ") || "none"}; {gen.failed} failed evaluation(s).
              </p>
              <NetworkViz model={gen.best.model} trace={null} inputs={null} chosen={null} selected={null} onSelect={() => undefined} />
              <p className="ml-note">
                {diffModels(shown.startModel, gen.best.model).length} parameter(s) differ from this run’s start model; {diffModels(ws.model, gen.best.model).length} differ from your active model.
                Only each generation’s best network is kept; run it in the game (Promote &amp; run) to see its live decision trace in the Network tab.
              </p>
              <div className="ml-row">
                <button type="button" onClick={() => onPromote(gen.best!.model, `Trained ${bestName(gen.best!)}`, false)}>Promote to workspace</button>
                <button type="button" className="is-primary" onClick={() => onPromote(gen.best!.model, `Trained ${bestName(gen.best!)}`, true)}>Promote &amp; run in game</button>
                <button type="button" onClick={() => onSaveSnapshot(`Trained ${bestName(gen.best!)} (fit ${Math.round(gen.best!.fitness)})`, gen.best!.model)}>Save as snapshot</button>
                {shown.globalBest && gen.best.candidateId !== shown.globalBest.candidateId && (
                  <button type="button" onClick={() => onPromote(shown.globalBest!.model, `Trained ${bestName(shown.globalBest!)}`, false)}>Promote all-time best</button>
                )}
              </div>
              <details>
                <summary>All {gen.candidates.length} candidates this generation (measured)</summary>
                <table>
                  <thead><tr><th>Candidate</th><th>Origin</th><th>Parent</th><th>Fitness</th><th>Outcome</th><th>Distance</th></tr></thead>
                  <tbody>
                    {gen.candidates.map((c) => (
                      <tr key={c.id}><td>{c.id}</td><td>{c.origin}</td><td>{c.parentId ?? "–"}</td><td>{c.fitness === null ? "failed" : c.fitness.toFixed(0)}</td><td>{c.termination ?? c.error}</td><td>{c.distance === null ? "–" : Math.round(c.distance)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          )}
          <div className="ml-row">
            {!running || shown.id !== liveSession?.id ? <button type="button" onClick={() => onDeleteTraining(shown.id)} disabled={!ws.trainings.some((t) => t.id === shown.id)}>Delete this saved session</button> : null}
            <span className="ml-note">Seed {shown.config.seed}, population {shown.config.populationSize}, mutation {shown.config.mutationRate}×{shown.config.mutationStrength}, {shown.config.eval.maxFrames}-frame budget.</span>
          </div>
        </>
      )}
      {sessions.length === 0 && <p className="ml-empty">No training sessions yet. Configure a bounded run above and press Start.</p>}
    </div>
  );
}

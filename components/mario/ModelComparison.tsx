"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { architectureSignature, compareModels } from "@/lib/nn/compare";
import { DEFAULT_EVAL_CONFIG } from "@/lib/mario/evaluation";
import { evaluationStore } from "@/lib/mario/evaluationStore";
import { ORIGIN_LABEL, buildModelSources } from "@/lib/mario/modelSources";
import { VERDICT_NOTE, compareSummaries } from "@/lib/mario/summary";
import { findEvaluation } from "@/lib/mario/validation";
import type { Workspace } from "@/lib/mario/workspace";
import type { NetworkModel } from "@/lib/nn/network";
import EvalSummaryView from "./EvalSummaryView";

interface Props {
  ws: Workspace;
  onPromote: (model: NetworkModel, label: string) => void;
}

export function useBatch() {
  return useSyncExternalStore(evaluationStore.subscribe, evaluationStore.get, evaluationStore.get);
}

/** Side-by-side comparison of any two models: provenance, parameter differences and matched measured outcomes. */
export default function ModelComparison({ ws, onPromote }: Props) {
  const sources = useMemo(() => buildModelSources(ws), [ws]);
  const [aId, setAId] = useState("starter");
  const [bId, setBId] = useState("active");
  const batch = useBatch();
  const a = sources.find((s) => s.id === aId) ?? sources[0];
  const b = sources.find((s) => s.id === bId) ?? sources[1] ?? sources[0];
  const diff = useMemo(() => compareModels(a.model, b.model), [a, b]);
  const ea = findEvaluation(ws.evaluations, a.hash, "matched");
  const eb = findEvaluation(ws.evaluations, b.hash, "matched");
  const verdict = ea && eb ? compareSummaries(ea, eb) : null;

  const runBoth = () => {
    const jobs = a.hash === b.hash ? [{ label: a.label, model: a.model, role: "matched" as const, context: "comparison" }] : [
      { label: a.label, model: a.model, role: "matched" as const, context: "comparison" },
      { label: b.label, model: b.model, role: "matched" as const, context: "comparison" },
    ];
    void evaluationStore.run(jobs, DEFAULT_EVAL_CONFIG);
  };

  const select = (value: string, set: (v: string) => void) => (
    <select value={value} onChange={(e) => set(e.target.value)}>
      {sources.map((s) => <option key={s.id} value={s.id}>{s.label} — {ORIGIN_LABEL[s.origin]}</option>)}
    </select>
  );

  return (
    <div className="ml-compare">
      <div className="ml-compare__pick">
        <label>Model A {select(aId, setAId)}</label>
        <label>Model B {select(bId, setBId)}</label>
      </div>
      <table>
        <thead><tr><th /><th>A</th><th>B</th></tr></thead>
        <tbody>
          <tr><th>Origin</th><td>{ORIGIN_LABEL[a.origin]}</td><td>{ORIGIN_LABEL[b.origin]}</td></tr>
          <tr><th>Detail</th><td>{a.detail}</td><td>{b.detail}</td></tr>
          <tr><th>Provenance</th><td>{a.provenance ? `${a.provenance.candidateId} (gen ${a.provenance.generation + 1})` : "unknown / not tracked"}</td><td>{b.provenance ? `${b.provenance.candidateId} (gen ${b.provenance.generation + 1})` : "unknown / not tracked"}</td></tr>
          <tr><th>Architecture</th><td>{architectureSignature(a.model)}</td><td>{architectureSignature(b.model)}</td></tr>
          <tr><th>Identical parameters?</th><td colSpan={2}>{a.hash === b.hash ? "yes, same content hash" : "no"}</td></tr>
        </tbody>
      </table>

      <h4>Parameter differences</h4>
      {!diff.compatible && (
        <ul className="ml-error">{diff.structural.map((s) => <li key={s}>{s}</li>)}</ul>
      )}
      {diff.comparedParams > 0 && (
        <p className="ml-note">
          {diff.changedParams} of {diff.comparedParams} compared parameters differ ({diff.percentChanged!.toFixed(0)}%) · max |Δ| {diff.maxAbsDiff!.toFixed(3)} · mean |Δ| {diff.meanAbsDiff!.toFixed(3)}
          {!diff.compatible ? " (compatible layers only)" : ""}.
        </p>
      )}
      {diff.changes.length > 0 && (
        <details open={diff.changes.length <= 8}>
          <summary>{diff.changes.length} change(s), largest first</summary>
          <table>
            <thead><tr><th>Parameter</th><th>A</th><th>B</th><th>Δ</th></tr></thead>
            <tbody>
              {diff.changes.slice(0, 30).map((c) => (
                <tr key={c.where}><td>{c.where}</td><td>{typeof c.a === "number" ? c.a.toFixed(3) : c.a}</td><td>{typeof c.b === "number" ? c.b.toFixed(3) : c.b}</td><td>{c.delta === undefined ? "—" : (c.delta > 0 ? "+" : "") + c.delta.toFixed(3)}</td></tr>
              ))}
            </tbody>
          </table>
          {diff.changes.length > 30 && <p className="ml-note">Showing the 30 largest of {diff.changes.length}.</p>}
        </details>
      )}

      <h4>Measured outcomes (matched protocol)</h4>
      <p className="ml-note">
        Both models run the same 6 start scenarios (canonical + 5 held-out approach starts), same frame budget and fitness formula. Edits of the weights or a different formula version make older results not applicable.
      </p>
      <div className="ml-row">
        <button type="button" className="is-primary" disabled={batch.running} onClick={runBoth}>{batch.running ? `Evaluating ${batch.done}/${batch.total}…` : "Evaluate A and B"}</button>
        {batch.running && <button type="button" onClick={() => evaluationStore.stop()}>Stop</button>}
      </div>
      {batch.error && <p className="ml-error" role="alert">{batch.error}</p>}
      <div className="ml-compare__eval">
        <EvalSummaryView record={ea} title="A" />
        <EvalSummaryView record={eb} title="B" />
      </div>
      {verdict && (
        <p className="ml-decision">
          B vs A: <b>{verdict.verdict}</b>. {verdict.reasons.join(" ")} <span className="ml-note">{VERDICT_NOTE}</span>
        </p>
      )}
      <div className="ml-row">
        <button type="button" onClick={() => onPromote(a.model, a.label)}>Promote A</button>
        <button type="button" onClick={() => onPromote(b.model, b.label)}>Promote B</button>
      </div>
    </div>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import { liveStore } from "@/lib/mario/liveStore";
import { INPUT_SCHEMA } from "@/lib/mario/observation";
import { ACTIONS } from "@/lib/mario/actions";

const f = (n: number) => n.toFixed(3);

export function useLive() {
  return useSyncExternalStore(liveStore.subscribe, liveStore.get, liveStore.get);
}

export function EpisodeMetricsPanel() {
  const { metrics: m } = useLive();
  if (!m) return <p className="ml-empty">No episode yet. Start the game to record metrics.</p>;
  return (
    <dl className="ml-metrics">
      <div><dt>Status</dt><dd>{m.status}</dd></div>
      <div><dt>Frames</dt><dd>{m.frames}</dd></div>
      <div><dt>Distance</dt><dd>{Math.round(m.distance)} px</dd></div>
      <div><dt>Progress to flag</dt><dd>{Math.round(m.progress * 100)}%</dd></div>
      <div><dt>Jumps</dt><dd>{m.jumps}</dd></div>
      <div><dt>Coins</dt><dd>{m.coins}</dd></div>
      <div><dt>Score</dt><dd>not exposed by the game</dd></div>
    </dl>
  );
}

export function DecisionInspector() {
  const { decision: d } = useLive();
  if (!d) return <p className="ml-empty">No decision yet. Choose “Neural network” or “Policy code” and press Run.</p>;
  const o = d.observation;
  return (
    <div className="ml-inspect">
      <p>
        <b>Frame {d.frame}</b> · model rev {d.modelRevision} · source: {d.source}
      </p>
      {!o.available ? (
        <p className="ml-note">{d.explanation}</p>
      ) : (
        <>
          <table>
            <thead>
              <tr><th>Input</th><th>Raw</th><th>Network input</th></tr>
            </thead>
            <tbody>
              {INPUT_SCHEMA.map((s, i) => {
                const raw = [o.raw.obstacleDistancePx, o.raw.pitDistancePx, o.raw.enemyDistancePx, o.raw.horizontalVelocity, o.raw.isGrounded][i];
                const rawText = raw === null ? "nothing in range" : typeof raw === "boolean" ? String(raw) : typeof raw === "number" && i < 3 ? `${Math.round(raw)} px` : f(raw);
                return (
                  <tr key={s.key}><td>{s.label} <small>({s.unit})</small></td><td>{rawText}</td><td>{f(o.inputs[i])}</td></tr>
                );
              })}
            </tbody>
          </table>
          {d.trace && (
            <>
              <table>
                <thead>
                  <tr><th>Neuron</th><th>Σ w·x</th><th>+ bias</th><th>z</th><th>→ output</th></tr>
                </thead>
                <tbody>
                  {d.trace.layers.flatMap((layer, li) =>
                    layer.neurons.map((n, ni) => (
                      <tr key={`${li}-${ni}`}>
                        <td>{li === d.trace!.layers.length - 1 ? ACTIONS[ni] : `H${ni + 1}`} <small>({n.activation})</small></td>
                        <td>{f(n.weightedSum)}</td><td>{f(n.bias)}</td><td>{f(n.z)}</td><td>{f(n.output)}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
              <p className="ml-note">Output scores are raw values, not probabilities.</p>
            </>
          )}
          <p className="ml-decision">
            Action: <b>{d.action ?? "none"}</b>. {d.explanation}
          </p>
        </>
      )}
    </div>
  );
}

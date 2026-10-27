"use client";

import { useState } from "react";
import { diffModels } from "@/lib/mario/workspace";
import type { Workspace } from "@/lib/mario/workspace";

interface Props {
  ws: Workspace;
  onSave: (name: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ExperimentsPanel({ ws, onSave, onRestore, onDelete }: Props) {
  const [name, setName] = useState("");
  const [compare, setCompare] = useState<string[]>([]);
  const toggle = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2)));
  const [a, b] = compare.map((id) => ws.snapshots.find((s) => s.id === id));
  const diffs = a && b ? diffModels(a.model, b.model) : null;

  return (
    <div className="ml-exp">
      <form
        className="ml-row"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(name);
          setName("");
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Snapshot name" aria-label="Snapshot name" />
        <button type="submit" className="is-primary">Save snapshot</button>
      </form>
      <p className="ml-note">Active: model rev {ws.revision} ({ws.basedOn ?? "edited, unsaved"}) · policy v{ws.codeVersion}</p>

      <h3>Snapshots</h3>
      {ws.snapshots.length === 0 && <p className="ml-empty">No snapshots yet.</p>}
      <ul className="ml-list">
        {ws.snapshots.map((s) => (
          <li key={s.id}>
            <label><input type="checkbox" checked={compare.includes(s.id)} onChange={() => toggle(s.id)} /> {s.name}</label>
            <span>
              <button type="button" onClick={() => onRestore(s.id)}>Restore</button>
              <button type="button" onClick={() => onDelete(s.id)}>Delete</button>
            </span>
          </li>
        ))}
      </ul>
      {compare.length === 2 && diffs && (
        <div>
          <p className="ml-note">Parameter differences, “{a!.name}” vs “{b!.name}”: {diffs.length === 0 ? "none" : diffs.length}</p>
          {diffs.length > 0 && (
            <table>
              <thead><tr><th>Parameter</th><th>{a!.name}</th><th>{b!.name}</th></tr></thead>
              <tbody>
                {diffs.slice(0, 40).map((d) => (
                  <tr key={d.where}><td>{d.where}</td><td>{typeof d.a === "number" ? d.a.toFixed(3) : d.a}</td><td>{typeof d.b === "number" ? d.b.toFixed(3) : d.b}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <h3>Finished episodes</h3>
      {ws.runs.length === 0 ? (
        <p className="ml-empty">Episodes are recorded when Mario dies or reaches the flag.</p>
      ) : (
        <table>
          <thead><tr><th>Model</th><th>Mode</th><th>Policy</th><th>Outcome</th><th>Distance</th><th>Progress</th><th>Jumps</th><th>Frames</th></tr></thead>
          <tbody>
            {ws.runs.map((r) => (
              <tr key={r.id}>
                <td>{r.label}</td><td>{r.mode}</td><td>v{r.codeVersion}</td><td>{r.metrics.status}</td>
                <td>{Math.round(r.metrics.distance)} px</td><td>{Math.round(r.metrics.progress * 100)}%</td><td>{r.metrics.jumps}</td><td>{r.metrics.frames}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="ml-note">
        Fairness: the game has no randomness and every reset reloads the same level, so runs start from the same state. Human runs depend on the player, and runs are
        only strictly comparable when the model, policy version and mode are the same. Each run stores a full copy of the model it used.
      </p>
    </div>
  );
}

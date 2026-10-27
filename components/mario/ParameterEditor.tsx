"use client";

import { useState } from "react";
import { ACTIVATION_NAMES } from "@/lib/nn/network";
import type { ActivationName, NetworkModel } from "@/lib/nn/network";
import { starterModel } from "@/lib/mario/starter";
import { ACTIONS } from "@/lib/mario/actions";
import { INPUT_SCHEMA } from "@/lib/mario/observation";
import type { Selected } from "./NetworkViz";

interface Props {
  model: NetworkModel;
  selected: Selected | null;
  onWeight: (layer: number, neuron: number, input: number, value: number) => void;
  onBias: (layer: number, neuron: number, value: number) => void;
  onActivation: (layer: number, a: ActivationName) => void;
}

/** Number field that only commits finite values and shows why anything else was rejected. */
function NumberField({ label, value, reset, onCommit }: { label: string; value: number; reset: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<{ source: number; text: string } | null>(null);
  const text = draft && draft.source === value ? draft.text : String(Number(value.toFixed(4)));
  const parsed = Number(text);
  const invalid = text.trim() === "" || !Number.isFinite(parsed);
  return (
    <div className="ml-field">
      <label>
        <span>{label}</span>
        <input
          type="number"
          step="0.05"
          value={text}
          aria-invalid={invalid}
          onChange={(e) => {
            setDraft({ source: value, text: e.target.value });
            const n = Number(e.target.value);
            if (e.target.value.trim() !== "" && Number.isFinite(n)) onCommit(n);
          }}
        />
      </label>
      <input type="range" min={-5} max={5} step={0.05} value={Math.max(-5, Math.min(5, value))} aria-label={`${label} slider (range −5 to 5; type a number for other values)`} onChange={(e) => onCommit(Number(e.target.value))} />
      <button type="button" onClick={() => onCommit(reset)} disabled={value === reset} title={`Reset to starter value ${reset}`}>
        reset
      </button>
      {invalid && <p className="ml-error">Enter a finite number. The model keeps its last valid value.</p>}
    </div>
  );
}

export default function ParameterEditor({ model, selected, onWeight, onBias, onActivation }: Props) {
  const starter = starterModel();
  if (!selected) return <p className="ml-empty">Select a hidden or output neuron in the diagram to edit its incoming weights and bias.</p>;
  const { layer, neuron } = selected;
  const l = model.layers[layer];
  const s = starter.layers[layer];
  if (!l?.weights[neuron]) return <p className="ml-empty">That neuron no longer exists.</p>;
  const isOutput = layer === model.layers.length - 1;
  const inName = (i: number) => (layer === 0 ? INPUT_SCHEMA[i].label : `Hidden ${i + 1}`);
  return (
    <div className="ml-params">
      <h3>
        {isOutput ? `Output “${ACTIONS[neuron]}”` : `Hidden neuron ${neuron + 1}`} <small>(layer {layer + 1})</small>
      </h3>
      <label className="ml-activation">
        Activation for layer {layer + 1}
        <select value={l.activation} onChange={(e) => onActivation(layer, e.target.value as ActivationName)}>
          {ACTIVATION_NAMES.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <p className="ml-note">z = Σ(weight × input) + bias, then activation(z). A larger weight does not always raise the output: it depends on the input’s sign, the activation and the layers after it.</p>
      <NumberField label="Bias" value={l.biases[neuron]} reset={s?.biases[neuron] ?? 0} onCommit={(v) => onBias(layer, neuron, v)} />
      {l.weights[neuron].map((w, i) => (
        <NumberField key={i} label={`w ← ${inName(i)}`} value={w} reset={s?.weights[neuron]?.[i] ?? 0} onCommit={(v) => onWeight(layer, neuron, i, v)} />
      ))}
    </div>
  );
}

"use client";

import type { ForwardResult, NetworkModel } from "@/lib/nn/network";
import { ACTIONS } from "@/lib/mario/actions";
import type { MarioAction } from "@/lib/mario/actions";
import { INPUT_SCHEMA } from "@/lib/mario/observation";

export interface Selected {
  layer: number; // index into model.layers (the layer the neuron belongs to)
  neuron: number;
}

interface Props {
  model: NetworkModel;
  trace: ForwardResult | null;
  inputs: number[] | null;
  chosen: MarioAction | null;
  selected: Selected | null;
  onSelect: (s: Selected) => void;
}

const W = 640;
const H = 300;
const R = 14;

const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2));

/** Draws the active model. Activations shown come from `trace`, the real forward pass of the latest decision. */
export default function NetworkViz({ model, trace, inputs, chosen, selected, onSelect }: Props) {
  const sizes = [model.inputSize, ...model.layers.map((l) => l.weights.length)];
  const x = (col: number) => 150 + (col * (W - 150 - 130)) / (sizes.length - 1);
  const y = (col: number, i: number) => 30 + ((i + 0.5) * (H - 60)) / sizes[col];
  const value = (col: number, i: number): number | null => (col === 0 ? (inputs ? inputs[i] : null) : trace ? trace.layers[col - 1].output[i] : null);
  const labels = (col: number, i: number) => (col === 0 ? INPUT_SCHEMA[i]?.label : col === sizes.length - 1 ? ACTIONS[i] : `H${i + 1}`);

  const edges = [];
  for (let l = 0; l < model.layers.length; l++) {
    for (let j = 0; j < sizes[l + 1]; j++) {
      for (let i = 0; i < sizes[l]; i++) {
        const w = model.layers[l].weights[j][i];
        const isSel = selected?.layer === l && selected.neuron === j;
        const term = trace ? trace.layers[l].neurons[j].terms[i] : null;
        edges.push(
          <line
            key={`${l}-${j}-${i}`}
            x1={x(l)} y1={y(l, i)} x2={x(l + 1)} y2={y(l + 1, j)}
            stroke={w >= 0 ? "#7d93f5" : "#ff8a6b"}
            strokeWidth={isSel ? 2.5 : 0.5 + Math.min(2, Math.abs(w))}
            opacity={isSel ? 0.95 : selected ? 0.12 : term !== null && Math.abs(term) > 0.05 ? 0.7 : 0.25}
          >
            <title>{`layer ${l + 1}, neuron ${j + 1}, input ${i + 1}: weight ${w.toFixed(3)}${term !== null ? `, contributed ${term.toFixed(3)}` : ""}`}</title>
          </line>,
        );
      }
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ml-viz" role="img" aria-label="Neural network diagram. Blue connections have positive weights, orange negative.">
      {edges}
      {sizes.map((n, col) =>
        Array.from({ length: n }, (_, i) => {
          const v = value(col, i);
          const isOutput = col === sizes.length - 1;
          const isSel = col > 0 && selected?.layer === col - 1 && selected.neuron === i;
          const isChosen = isOutput && chosen === ACTIONS[i];
          const fill = col === 0 ? "#2547e8" : isOutput ? "#5f31c4" : "#55606d";
          const interactive = col > 0;
          return (
            <g
              key={`${col}-${i}`}
              className={interactive ? "ml-node is-interactive" : "ml-node"}
              onClick={interactive ? () => onSelect({ layer: col - 1, neuron: i }) : undefined}
              onKeyDown={interactive ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect({ layer: col - 1, neuron: i })) : undefined}
              tabIndex={interactive ? 0 : undefined}
              role={interactive ? "button" : undefined}
              aria-label={`${labels(col, i)}${v !== null ? `, value ${v.toFixed(3)}` : ", no value yet"}`}
            >
              <circle cx={x(col)} cy={y(col, i)} r={R} fill={fill} fillOpacity={v === null ? 0.35 : 0.5 + 0.5 * Math.min(1, Math.abs(v))} stroke={isChosen ? "#c6f04a" : isSel ? "#eef0f2" : "#30343b"} strokeWidth={isChosen || isSel ? 3 : 1} />
              <text x={x(col)} y={y(col, i) + 4} textAnchor="middle" className="ml-val">{v === null ? "–" : fmt(v)}</text>
              <text x={col === 0 ? x(col) - R - 6 : x(col) + R + 6} y={y(col, i) + 4} textAnchor={col === 0 ? "end" : "start"} className="ml-label">
                {labels(col, i)}
                {isChosen ? " ◀ chosen" : ""}
              </text>
            </g>
          );
        }),
      )}
      {!trace && (
        <text x={W / 2} y={H - 6} textAnchor="middle" className="ml-label">
          No decision yet: start the game in Neural network mode to see real activations.
        </text>
      )}
    </svg>
  );
}

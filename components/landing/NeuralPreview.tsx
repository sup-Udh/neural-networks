"use client";

import { useMemo, useState } from "react";

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

export default function NeuralPreview() {
  const [input, setInput] = useState(0.68);
  const [hasRun, setHasRun] = useState(false);
  const { hiddenA, hiddenB, output } = useMemo(() => {
    const secondInput = 0.42;
    const hiddenA = sigmoid(input * 1.4 + secondInput * 0.45 - 0.18);
    const hiddenB = sigmoid(input * -0.9 + secondInput * 1.2 + 0.35);
    const output = sigmoid(hiddenA * 1.15 + hiddenB * -0.72 - 0.1);
    return { hiddenA, hiddenB, output };
  }, [input]);

  const activeOutput = output >= 0.5 ? "PATTERN DETECTED" : "NO PATTERN";

  return (
    <div className={`preview-panel ${hasRun ? "has-run" : ""}`}>
      <div className="preview-topline">
        <div><span className="live-dot" />MODEL SANDBOX <span className="muted-code">/ PERCEPTRON 01</span></div>
        <span className="preview-status">{hasRun ? "FORWARD PASS COMPLETE" : "READY TO EXPLORE"}</span>
      </div>
      <div className="preview-workspace">
        <div className="network-chart">
          <svg viewBox="0 0 620 270" role="img" aria-label={`A small neural network: input ${input.toFixed(2)}, hidden activations ${hiddenA.toFixed(2)} and ${hiddenB.toFixed(2)}, output ${output.toFixed(2)}.`}>
            <defs>
              <linearGradient id="signalGradient"><stop stopColor="#5c78f5" stopOpacity=".9"/><stop offset="1" stopColor="#5c78f5" stopOpacity=".08"/></linearGradient>
            </defs>
            <g className="chart-edges">
              <path d="M105 83 302 65M105 83 302 205M105 190 302 65M105 190 302 205M302 65 510 135M302 205 510 135" />
              <path className="active-edge edge-a" d="M105 83 302 65" />
              <path className="active-edge edge-b" d="M105 83 302 205" />
              <path className="active-edge edge-c" d="M302 65 510 135" />
              <path className="active-edge edge-d" d="M302 205 510 135" />
            </g>
            <g className="chart-node input-node"><circle cx="105" cy="83" r="24"/><text x="105" y="88">{input.toFixed(2)}</text></g>
            <g className="chart-node input-node second-input"><circle cx="105" cy="190" r="24"/><text x="105" y="195">0.42</text></g>
            <g className="chart-node hidden-node"><circle cx="302" cy="65" r="22"/><text x="302" y="70">{hiddenA.toFixed(2)}</text></g>
            <g className="chart-node hidden-node"><circle cx="302" cy="205" r="22"/><text x="302" y="210">{hiddenB.toFixed(2)}</text></g>
            <g className="chart-node output-node"><circle cx="510" cy="135" r="26"/><text x="510" y="140">{output.toFixed(2)}</text></g>
            <text className="layer-caption" x="105" y="252">INPUT</text><text className="layer-caption" x="302" y="252">HIDDEN</text><text className="layer-caption" x="510" y="252">OUTPUT</text>
          </svg>
        </div>
        <div className="preview-controls">
          <div className="control-heading"><span>01 / INPUT SIGNAL</span><strong>{input.toFixed(2)}</strong></div>
          <label className="sr-only" htmlFor="input-signal">Adjust input signal</label>
          <input id="input-signal" type="range" min="0" max="1" step="0.01" value={input} onChange={(event) => { setInput(Number(event.target.value)); setHasRun(false); }} />
          <div className="range-ends"><span>0.00</span><span>1.00</span></div>
          <div className="prediction"><span>MODEL PREDICTION</span><strong className={output >= 0.5 ? "prediction-positive" : ""}>{hasRun ? activeOutput : "AWAITING SIGNAL"}</strong></div>
          <button className="run-button" type="button" onClick={() => setHasRun(true)}>Run forward pass <span aria-hidden="true">↗</span></button>
        </div>
      </div>
      <div className="preview-footline"><span>2 INPUTS <i /> 2 HIDDEN UNITS <i /> 1 OUTPUT</span><span>ACTIVATION: SIGMOID</span></div>
    </div>
  );
}

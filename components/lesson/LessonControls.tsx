"use client";

import { ACTIVATIONS, ACTIVATION_IDS, formatNumber, formatOperand } from "@/lib/neuron/neuron";
import type { ActivationId } from "@/lib/neuron/neuron";
import { STEP_COUNT, describeStep } from "@/lib/neuron/steps";
import { useLesson } from "./LessonProvider";
import type { NumericParam, Speed } from "./LessonProvider";

const RANGE: Record<NumericParam, { min: number; max: number; step: number; label: string; symbol: string }> = {
  x1: { min: -3, max: 3, step: 0.1, label: "Input 1", symbol: "x₁" },
  x2: { min: -3, max: 3, step: 0.1, label: "Input 2", symbol: "x₂" },
  w1: { min: -2, max: 2, step: 0.05, label: "Weight 1", symbol: "w₁" },
  w2: { min: -2, max: 2, step: 0.05, label: "Weight 2", symbol: "w₂" },
  bias: { min: -2, max: 2, step: 0.05, label: "Bias", symbol: "b" },
};

/** Sliders bound to the shared model. `keys` picks which parameters a section exposes. */
export function ParamSliders({ keys }: { keys: NumericParam[] }) {
  const { params, setParam } = useLesson();
  return (
    <div className="lc-sliders" data-no-toolbar>
      {keys.map((key) => {
        const spec = RANGE[key];
        const id = `param-${key}-${keys.join("")}`;
        const value = params[key];
        return (
          <div className="doc-control" key={key}>
            <label htmlFor={id}>{spec.label} <b>{spec.symbol}</b></label>
            <input id={id} type="range" min={spec.min} max={spec.max} step={spec.step} value={value} data-companion-inspect
              aria-valuetext={`${spec.symbol} equals ${formatNumber(value)}`}
              onChange={(event) => setParam(key, Number(event.target.value))} />
            <output htmlFor={id}>{value > 0 && key !== "x1" && key !== "x2" ? "+" : ""}{formatNumber(value)}</output>
          </div>
        );
      })}
    </div>
  );
}

export function ActivationSelect({ groupLabel = "Activation function" }: { groupLabel?: string }) {
  const { params, setActivation } = useLesson();
  return (
    <div className="lc-activation" role="radiogroup" aria-label={groupLabel} data-no-toolbar>
      {ACTIVATION_IDS.map((id: ActivationId) => (
        <button key={`${groupLabel}-${id}`} type="button" role="radio" aria-checked={params.activation === id} data-companion-inspect onClick={() => setActivation(id)}>
          <strong>{ACTIVATIONS[id].label}</strong>
          <span>{ACTIVATIONS[id].formula}</span>
        </button>
      ))}
    </div>
  );
}

/** The equation with the learner's numbers substituted in. Terms light up with the playback step. */
export function LiveEquation() {
  const { params: p, result: r, step } = useLesson();
  const hot = (...steps: number[]) => (step !== null && steps.includes(step) ? "is-hot" : "");
  return (
    <div className="doc-equation lc-equation" role="group" aria-label="Live equation with your current values" data-no-toolbar>
      <div className="lc-eq-line is-general">z = w₁x₁ + w₂x₂ + b</div>
      <div className="lc-eq-line">
        <span>z = </span>
        <span className={hot(1)}>{formatOperand(p.w1)}×{formatOperand(p.x1)}</span>
        <span> + </span>
        <span className={hot(1)}>{formatOperand(p.w2)}×{formatOperand(p.x2)}</span>
        <span> + </span>
        <span className={hot(3)}>{formatOperand(p.bias)}</span>
      </div>
      <div className="lc-eq-line">
        <span>z = </span>
        <span className={hot(1, 2)}>{formatNumber(r.products[0])}</span>
        <span> + </span>
        <span className={hot(1, 2)}>{formatOperand(r.products[1])}</span>
        <span> + </span>
        <span className={hot(3)}>{formatOperand(p.bias)}</span>
        <span className={hot(2, 3)}> = {formatNumber(r.z)}</span>
      </div>
      <div className={`lc-eq-line ${hot(4, 5)}`}>a = {ACTIVATIONS[p.activation].label.toLowerCase()}({formatNumber(r.z)}) = <b>{formatNumber(r.a)}</b></div>
    </div>
  );
}

export function PlaybackControls() {
  const lesson = useLesson();
  const { status, step, speed } = lesson;
  const playing = status === "playing";
  const paused = status === "paused";
  const started = step !== null;
  const info = describeStep(lesson.params, step ?? STEP_COUNT - 1);
  return (
    <div className="lc-playback" data-no-toolbar data-fr-busy={playing || undefined}>
      <div className="lc-buttons" role="group" aria-label="Playback controls">
        <button type="button" className="is-primary" onClick={lesson.run} disabled={playing || paused}>Run</button>
        <button type="button" onClick={lesson.pause} disabled={!playing}>Pause</button>
        <button type="button" onClick={lesson.resume} disabled={!paused}>Resume</button>
        <button type="button" onClick={lesson.prev} disabled={!started || playing} aria-label="Previous step">← Prev</button>
        <button type="button" onClick={lesson.next} disabled={playing || status === "done"} aria-label="Next step">Next →</button>
        <button type="button" onClick={lesson.run} disabled={!started}>Replay</button>
        <button type="button" onClick={lesson.reset} disabled={!started}>Reset</button>
        <label className="lc-speed">
          Speed
          <select value={speed} onChange={(e) => lesson.setSpeed(Number(e.target.value) as Speed)}>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
        </label>
      </div>
      <ol className="lc-steps" aria-label="Computation steps">
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <li key={i}>
            <button type="button" aria-current={step === i ? "step" : undefined} aria-label={`Go to step ${i + 1}: ${describeStep(lesson.params, i).title}`}
              disabled={playing} onClick={() => lesson.gotoStep(i)}>{i + 1}</button>
          </li>
        ))}
      </ol>
      <div className="lc-step-text" role="status" aria-live="polite">
        <strong>{started ? `Step ${(step ?? 0) + 1} of ${STEP_COUNT} · ${info.title}` : "Press Run to watch the neuron compute"}</strong>
        <span>{started ? info.text : `With your current settings the final output is ${formatNumber(lesson.result.a)}.`}</span>
      </div>
    </div>
  );
}

/** Plots the selected activation and marks the current z on it. */
export function ActivationGraph() {
  const { params: p, result: r } = useLesson();
  const W = 320;
  const H = 180;
  const XR = 4;
  const sx = (z: number) => ((z + XR) / (2 * XR)) * W;
  const values = Array.from({ length: 81 }, (_, i) => {
    const z = -XR + (i / 80) * 2 * XR;
    return { z, y: ACTIVATIONS[p.activation].fn(z) };
  });
  const YMIN = -1.5;
  const YMAX = 4;
  const sy = (y: number) => H - ((Math.min(YMAX, Math.max(YMIN, y)) - YMIN) / (YMAX - YMIN)) * H;
  const path = values.map((v, i) => `${i ? "L" : "M"}${sx(v.z).toFixed(1)},${sy(v.y).toFixed(1)}`).join(" ");
  const zc = Math.min(XR, Math.max(-XR, r.z));
  return (
    <figure className="ag" data-no-toolbar>
      <svg viewBox={`-28 -10 ${W + 44} ${H + 40}`} role="img" aria-label={`Graph of ${ACTIVATIONS[p.activation].label}. The marker shows z = ${formatNumber(r.z)} giving a = ${formatNumber(r.a)}.`}>
        <line className="ag-axis" x1={0} x2={W} y1={sy(0)} y2={sy(0)} />
        <line className="ag-axis" x1={sx(0)} x2={sx(0)} y1={0} y2={H} />
        <path className="ag-curve" d={path} fill="none" />
        <line className="ag-guide" x1={sx(zc)} x2={sx(zc)} y1={sy(0)} y2={sy(r.a)} />
        <circle className="ag-dot" cx={sx(zc)} cy={sy(r.a)} r={5.5} />
        <text className="ag-text" x={W} y={sy(0) + 16} textAnchor="end">z</text>
        <text className="ag-text" x={sx(0) + 6} y={8}>a</text>
        <text className="ag-text" x={-4} y={sy(0) + 4} textAnchor="end">0</text>
        <text className="ag-text" x={-4} y={sy(1) + 4} textAnchor="end">1</text>
        <text className="ag-text" x={sx(-XR) } y={H + 20}>−4</text>
        <text className="ag-text" x={sx(XR)} y={H + 20} textAnchor="end">4</text>
      </svg>
      <figcaption>
        z = {formatNumber(r.z)} → a = <b>{formatNumber(r.a)}</b>
        {Math.abs(r.z) > XR && " (marker pinned to the edge of the graph)"}
      </figcaption>
    </figure>
  );
}

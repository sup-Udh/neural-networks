"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import { ACTIVATIONS, formatNumber } from "@/lib/neuron/neuron";
import { STEP_COUNT } from "@/lib/neuron/steps";
import { STEP_MS, useLesson } from "./LessonProvider";

type Pick = "x1" | "x2" | "bias" | "neuron" | "out" | "w1" | "w2";
type Pt = { x: number; y: number };

const N = {
  x1: { x: 84, y: 86, r: 26 },
  x2: { x: 84, y: 214, r: 26 },
  bias: { x: 330, y: 34, r: 20 },
  neuron: { x: 330, y: 150, r: 48 },
  out: { x: 560, y: 150, r: 34 },
};

const signed = (n: number) => (n >= 0 ? `+${formatNumber(n)}` : formatNumber(n));

/** A line between two circles, trimmed to their edges, plus the arrowhead polygon at the end. */
function connect(a: { x: number; y: number; r: number }, b: { x: number; y: number; r: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const start: Pt = { x: a.x + ux * a.r, y: a.y + uy * a.r };
  const end: Pt = { x: b.x - ux * b.r, y: b.y - uy * b.r };
  const tip = end;
  const base = { x: end.x - ux * 10, y: end.y - uy * 10 };
  const head = `${tip.x},${tip.y} ${base.x - uy * 5},${base.y + ux * 5} ${base.x + uy * 5},${base.y - ux * 5}`;
  return { start, end, head, mid: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } };
}

export default function NeuronViz() {
  const lesson = useLesson();
  const { params: p, result: r, step, status, speed, codeResult } = lesson;
  const [picked, setPicked] = useState<Pick | null>(null);

  // `level` is how far the computation has been revealed; the settled view (step null) shows everything.
  const level = step ?? STEP_COUNT - 1;
  const live = step !== null;
  const hot = (s: number) => live && step === s;

  const e1 = connect(N.x1, N.neuron);
  const e2 = connect(N.x2, N.neuron);
  const eb = connect(N.bias, N.neuron);
  const eo = connect(N.neuron, N.out);

  const weightEdge = (key: "w1" | "w2", edge: ReturnType<typeof connect>, w: number, product: number, sym: string, xSym: string) => {
    const mag = Math.min(Math.abs(w), 2);
    const cls = `nv-edge ${w < 0 ? "is-neg" : "is-pos"} ${hot(1) ? "is-hot" : ""} ${picked === key ? "is-picked" : ""}`;
    const toggle = () => setPicked((cur) => (cur === key ? null : key));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    };
    return (
      <g key={key}>
        <line className={cls} x1={edge.start.x} y1={edge.start.y} x2={edge.end.x} y2={edge.end.y}
          strokeWidth={1.5 + mag * 2.5} strokeDasharray={w < 0 ? "7 5" : undefined} opacity={0.35 + (mag / 2) * 0.65} />
        <polygon className={cls} points={edge.head} opacity={0.35 + (mag / 2) * 0.65} />
        <g className="nv-label" role="button" tabIndex={0} aria-pressed={picked === key} onClick={toggle} onKeyDown={onKey}
          aria-label={`Weight ${sym} is ${signed(w)}, a ${w < 0 ? "negative" : w > 0 ? "positive" : "zero"} weight. Press to inspect.`}
          transform={`translate(${edge.mid.x}, ${edge.mid.y})`}>
          <rect x={-46} y={level >= 1 ? -22 : -13} width={92} height={level >= 1 ? 44 : 26} rx={6} />
          <text y={level >= 1 ? -5 : 4} textAnchor="middle">{`${sym} = ${signed(w)}`}</text>
          {level >= 1 && <text className="nv-sub" y={12} textAnchor="middle">{`${xSym}${sym} = ${formatNumber(product)}`}</text>}
        </g>
      </g>
    );
  };

  const nodeProps = (key: Pick, label: string) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-pressed": picked === key,
    "aria-label": label,
    onClick: () => setPicked((cur) => (cur === key ? null : key)),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setPicked((cur) => (cur === key ? null : key));
      }
    },
  });

  const signalMs = (STEP_MS * 0.8) / speed;
  const signal = (key: string, from: Pt, to: Pt) => (
    <circle key={key} className="nv-signal" cx={from.x} cy={from.y} r={6}
      style={{ ["--dx" as string]: `${to.x - from.x}px`, ["--dy" as string]: `${to.y - from.y}px`, animationDuration: `${signalMs}ms`, animationPlayState: status === "paused" ? "paused" : "running" }} />
  );

  const codeFresh = codeResult && JSON.stringify(codeResult.params) === JSON.stringify(p);

  const detail: Record<Pick, string> = {
    x1: `Input x₁ = ${formatNumber(p.x1)}. It reaches the neuron through weight w₁ = ${signed(p.w1)}.`,
    x2: `Input x₂ = ${formatNumber(p.x2)}. It reaches the neuron through weight w₂ = ${signed(p.w2)}.`,
    bias: `Bias b = ${signed(p.bias)}. It is added to the weighted sum no matter what the inputs are.`,
    neuron: `Neuron: z = ${formatNumber(r.sum)} + ${signed(p.bias)} = ${formatNumber(r.z)}, then ${ACTIVATIONS[p.activation].formula}, so a = ${formatNumber(r.a)}.`,
    out: `Output a = ${formatNumber(r.a)}, the neuron's prediction for these settings.`,
    w1: `Weight w₁ = ${signed(p.w1)} (${p.w1 < 0 ? "negative: a larger x₁ lowers z" : p.w1 > 0 ? "positive: a larger x₁ raises z" : "zero: x₁ is ignored"}). Contribution x₁w₁ = ${formatNumber(r.products[0])}.`,
    w2: `Weight w₂ = ${signed(p.w2)} (${p.w2 < 0 ? "negative: a larger x₂ lowers z" : p.w2 > 0 ? "positive: a larger x₂ raises z" : "zero: x₂ is ignored"}). Contribution x₂w₂ = ${formatNumber(r.products[1])}.`,
  };

  return (
    <figure className="nv" data-no-toolbar>
      <svg viewBox="0 0 640 270" role="group" aria-label="Diagram of a neuron with two inputs, two weights, a bias and one output">
        {weightEdge("w1", e1, p.w1, r.products[0], "w₁", "x₁")}
        {weightEdge("w2", e2, p.w2, r.products[1], "w₂", "x₂")}

        <line className={`nv-edge is-bias ${hot(3) ? "is-hot" : ""}`} x1={eb.start.x} y1={eb.start.y} x2={eb.end.x} y2={eb.end.y} strokeWidth={2} strokeDasharray="2 4" />
        <polygon className={`nv-edge is-bias ${hot(3) ? "is-hot" : ""}`} points={eb.head} />
        <line className={`nv-edge is-out ${hot(5) ? "is-hot" : ""}`} x1={eo.start.x} y1={eo.start.y} x2={eo.end.x} y2={eo.end.y} strokeWidth={3} />
        <polygon className={`nv-edge is-out ${hot(5) ? "is-hot" : ""}`} points={eo.head} />

        {[["x1", N.x1, "x₁", p.x1], ["x2", N.x2, "x₂", p.x2]].map(([key, node, sym, val]) => {
          const n = node as typeof N.x1;
          return (
            <g key={key as string} className={`nv-node ${hot(0) ? "is-hot" : ""} ${picked === key ? "is-picked" : ""}`} {...nodeProps(key as Pick, `Input ${sym} is ${formatNumber(val as number)}`)}>
              <circle cx={n.x} cy={n.y} r={n.r} />
              <text x={n.x} y={n.y - 2} textAnchor="middle" className="nv-value">{formatNumber(val as number)}</text>
              <text x={n.x} y={n.y + 14} textAnchor="middle" className="nv-sub">{sym as string}</text>
            </g>
          );
        })}

        <g className={`nv-node ${hot(3) ? "is-hot" : ""} ${picked === "bias" ? "is-picked" : ""}`} {...nodeProps("bias", `Bias b is ${formatNumber(p.bias)}`)}>
          <circle cx={N.bias.x} cy={N.bias.y} r={N.bias.r} />
          <text x={N.bias.x} y={N.bias.y + 4} textAnchor="middle" className="nv-value is-small">{level >= 3 || !live ? `b ${signed(p.bias)}` : "b"}</text>
        </g>

        <g className={`nv-node nv-neuron ${hot(2) ? "is-hot" : ""} ${hot(4) ? "is-act" : ""} ${picked === "neuron" ? "is-picked" : ""}`}
          {...nodeProps("neuron", `Neuron. Weighted sum ${formatNumber(r.sum)}, z ${formatNumber(r.z)}, activation ${ACTIVATIONS[p.activation].label}`)}>
          <circle cx={N.neuron.x} cy={N.neuron.y} r={N.neuron.r} />
          <text x={N.neuron.x} y={N.neuron.y - 6} textAnchor="middle" className="nv-sub">{level >= 3 ? "z" : level >= 2 ? "Σ" : "Σ + b"}</text>
          <text x={N.neuron.x} y={N.neuron.y + 14} textAnchor="middle" className="nv-value">{level >= 3 ? formatNumber(r.z) : level >= 2 ? formatNumber(r.sum) : "?"}</text>
        </g>
        <text x={N.neuron.x} y={N.neuron.y + N.neuron.r + 20} textAnchor="middle" className={`nv-act ${hot(4) ? "is-hot" : ""}`}>
          {`f = ${ACTIVATIONS[p.activation].label}`}
        </text>

        <g className={`nv-node nv-out ${hot(5) ? "is-hot" : ""} ${picked === "out" ? "is-picked" : ""}`} {...nodeProps("out", `Output a is ${level >= 5 ? formatNumber(r.a) : "not yet computed"}`)}>
          <circle cx={N.out.x} cy={N.out.y} r={N.out.r} />
          <text x={N.out.x} y={N.out.y - 2} textAnchor="middle" className="nv-value">{level >= 5 ? formatNumber(r.a) : "?"}</text>
          <text x={N.out.x} y={N.out.y + 14} textAnchor="middle" className="nv-sub">a</text>
        </g>
        {codeFresh && codeResult && (
          <text x={N.out.x} y={N.out.y + N.out.r + 22} textAnchor="middle" className="nv-code-tag">
            {codeResult.matches ? `Your code: ${formatNumber(codeResult.value)} ✓ (${codeResult.matches})` : `Your code: ${formatNumber(codeResult.value)} (differs)`}
          </text>
        )}

        {live && status !== "idle" && step === 1 && (
          <>
            {signal("s1", e1.start, e1.end)}
            {signal("s2", e2.start, e2.end)}
          </>
        )}
        {live && status !== "idle" && step === 3 && signal("sb", eb.start, eb.end)}
        {live && status !== "idle" && step === 5 && signal("so", eo.start, eo.end)}
      </svg>
      <figcaption className="nv-caption" aria-live="polite">
        {picked ? detail[picked] : "Select a node or a weight label to inspect it. Dashed lines are negative weights; thicker lines are larger weights."}
      </figcaption>
    </figure>
  );
}

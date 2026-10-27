"use client";

import type { GenerationSummary } from "@/lib/mario/trainer";

interface Props {
  generations: GenerationSummary[];
  selected: number | null;
  onSelect: (index: number) => void;
}

const W = 520;
const H = 190;
const PAD = { l: 44, r: 12, t: 26, b: 26 };

/** Raw per-generation best and average fitness (no smoothing), plus the completion rate of each generation. */
export default function FitnessChart({ generations, selected, onSelect }: Props) {
  const pts = generations.filter((g) => g.best && g.avgFitness !== null);
  if (pts.length === 0) return <p className="ml-empty">No finished generation yet. Fitness will be plotted here as results arrive.</p>;
  const maxF = Math.max(1, ...pts.map((g) => g.best!.fitness));
  const minF = Math.min(0, ...pts.map((g) => g.avgFitness!));
  const n = Math.max(generations.length, 2);
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / (n - 1);
  const y = (v: number) => PAD.t + (1 - (v - minF) / (maxF - minF)) * (H - PAD.t - PAD.b);
  const line = (get: (g: GenerationSummary) => number | null) =>
    generations
      .map((g, i) => (get(g) === null ? null : `${x(i).toFixed(1)},${y(get(g)!).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");
  const ticks = [minF, (minF + maxF) / 2, maxF];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ml-viz ml-chart" role="img" aria-label="Best and average fitness by generation">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#30343b" strokeWidth={0.5} />
          <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" className="ml-label">{Math.round(t)}</text>
        </g>
      ))}
      <polyline fill="none" stroke="#c6f04a" strokeWidth={2} points={line((g) => g.best?.fitness ?? null)} />
      <polyline fill="none" stroke="#7d93f5" strokeWidth={2} points={line((g) => g.avgFitness)} />
      {generations.map((g, i) => (
        <g key={g.index} onClick={() => onSelect(i)} className="is-interactive" role="button" tabIndex={0} aria-label={`Generation ${i + 1}: best ${g.best ? Math.round(g.best.fitness) : "none"}`} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(i))}>
          {g.best && <circle cx={x(i)} cy={y(g.best.fitness)} r={selected === i ? 5 : 3} fill="#c6f04a" stroke={selected === i ? "#eef0f2" : "none"} />}
          {g.avgFitness !== null && <circle cx={x(i)} cy={y(g.avgFitness)} r={2.5} fill="#7d93f5" />}
          <rect x={x(i) - 6} y={H - PAD.b + 4} width={12} height={4} fill="#30343b" />
          <rect x={x(i) - 6} y={H - PAD.b + 4} width={12 * g.completionRate} height={4} fill="#5f31c4" />
          <text x={x(i)} y={H - 4} textAnchor="middle" className="ml-label">{i + 1}</text>
          <title>{`Generation ${i + 1}: best ${g.best ? g.best.fitness.toFixed(0) : "–"}, average ${g.avgFitness !== null ? g.avgFitness.toFixed(0) : "–"}, completed ${(g.completionRate * 100).toFixed(0)}%, failed evaluations ${g.failed}`}</title>
        </g>
      ))}
      <text x={PAD.l} y={9} className="ml-label" fill="#c6f04a">— best</text>
      <text x={PAD.l + 50} y={9} className="ml-label" fill="#7d93f5">— average</text>
      <text x={PAD.l + 120} y={9} className="ml-label" fill="#9a7be0">▮ completion rate (small bar per generation)</text>
    </svg>
  );
}

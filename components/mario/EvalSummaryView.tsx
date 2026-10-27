"use client";

import type { EvaluationRecord } from "@/lib/mario/validation";

const pct = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(0)}%`);
const frames = (n: number | null) => (n === null ? "—" : `${Math.round(n)} fr`);

/** Measured outcomes for one model, or an explicit "not evaluated" (never zeros for missing data). */
export default function EvalSummaryView({ record, title }: { record: EvaluationRecord | null; title?: string }) {
  if (!record) return <p className="ml-empty">{title ? `${title}: ` : ""}not evaluated under the current protocol yet.</p>;
  const s = record.summary;
  return (
    <table className="ml-eval">
      <caption>
        {title ?? record.label} · protocol v{record.protocolVersion}, fitness v{record.fitnessVersion} · {s.episodes} episodes over {s.distinctScenarios} scenario{s.distinctScenarios === 1 ? "" : "s"}
      </caption>
      <tbody>
        <tr><th>Completed</th><td>{s.completions} / {s.episodes} ({pct(s.completionRate)})</td></tr>
        <tr><th>Progress avg · best · worst</th><td>{pct(s.avgProgress)} · {pct(s.bestProgress)} · {pct(s.worstProgress)}</td></tr>
        <tr><th>Completion time (successful only)</th><td>{s.completionSamples === 0 ? "— (no successful episode)" : `avg ${frames(s.avgCompletionFrames)} over ${s.completionSamples} · fastest ${frames(s.fastestCompletionFrames)}`}</td></tr>
        <tr><th>Deaths · stalls · budget out</th><td>{s.deaths} · {s.stalls} · {s.budgets}</td></tr>
        <tr><th>Fitness mean (min–max)</th><td>{s.fitnessMean === null ? "—" : `${Math.round(s.fitnessMean)} (${Math.round(s.fitnessMin!)}–${Math.round(s.fitnessMax!)})`}</td></tr>
      </tbody>
    </table>
  );
}

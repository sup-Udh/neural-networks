"use client";

import { useState } from "react";
import { SCENARIOS, evaluate } from "@/lib/neuron/challenge";
import type { Direction } from "@/lib/neuron/challenge";
import { progressStore, usePersisted } from "@/lib/storage/stores";
import { ACTIVATIONS, formatNumber } from "@/lib/neuron/neuron";
import { useLesson } from "./LessonProvider";

const CHOICES: { id: Direction; label: string }[] = [
  { id: "increase", label: "The output goes up" },
  { id: "decrease", label: "The output goes down" },
  { id: "same", label: "The output stays the same" },
];

export default function Challenge({ onComplete }: { onComplete: () => void }) {
  const lesson = useLesson();
  const progress = usePersisted(progressStore);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<Direction | null>(null);
  const [verdict, setVerdict] = useState<ReturnType<typeof evaluate> | null>(null);
  const scenario = SCENARIOS[index];
  const b = scenario.base;

  const submit = () => {
    if (!choice) return;
    const result = evaluate(scenario, choice);
    setVerdict(result);
    if (result.correct && !progress.challengeComplete) {
      progressStore.set({ challengeComplete: true });
      onComplete();
    }
  };

  const loadIntoSimulator = (withChange: boolean) => {
    const p = { ...b, ...(withChange ? scenario.change : {}) };
    (["x1", "x2", "w1", "w2", "bias"] as const).forEach((key) => lesson.setParam(key, p[key]));
    lesson.setActivation(p.activation);
  };

  return (
    <div className="ch" data-no-toolbar>
      <div className="ch-head">
        <span>Question {index + 1} of {SCENARIOS.length}</span>
        {progress.challengeComplete && <span className="ch-done">✓ Challenge completed</span>}
      </div>
      <p className="ch-prompt">{scenario.prompt}</p>
      <p className="ch-setup">
        Starting point: x₁ = {formatNumber(b.x1)}, x₂ = {formatNumber(b.x2)}, w₁ = {formatNumber(b.w1)}, w₂ = {formatNumber(b.w2)}, b = {formatNumber(b.bias)}, activation = {ACTIVATIONS[b.activation].label}.
      </p>
      <fieldset disabled={verdict !== null}>
        <legend>Your prediction</legend>
        {CHOICES.map((c) => (
          <label key={c.id} className={choice === c.id ? "is-chosen" : ""}>
            <input type="radio" name={`predict-${scenario.id}`} checked={choice === c.id} onChange={() => setChoice(c.id)} />
            {c.label}
          </label>
        ))}
      </fieldset>
      <div className="ch-actions">
        {!verdict && <button type="button" className="doc-button" disabled={!choice} onClick={submit}>Check my prediction</button>}
        {verdict && <button type="button" onClick={() => { setVerdict(null); setChoice(null); }}>Try this one again</button>}
        {verdict && <button type="button" onClick={() => { setIndex((index + 1) % SCENARIOS.length); setVerdict(null); setChoice(null); }}>Next question</button>}
        <button type="button" onClick={() => loadIntoSimulator(verdict !== null)}>{verdict ? "Load the changed values into the simulator" : "Load the starting point into the simulator"}</button>
      </div>
      <div className="ch-result" role="status" aria-live="polite">
        {verdict && (
          <p className={verdict.correct ? "is-right" : "is-wrong"}>
            <b>{verdict.correct ? "✓ Correct. " : "✗ Not quite. "}</b>
            {verdict.correct ? "" : `The output actually ${verdict.direction === "same" ? "stays the same" : verdict.direction === "increase" ? "goes up" : "goes down"}. `}
            {verdict.why}
          </p>
        )}
      </div>
    </div>
  );
}

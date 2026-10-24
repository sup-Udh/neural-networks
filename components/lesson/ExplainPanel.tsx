"use client";

import { useEffect, useRef } from "react";
import { explainPassage, unpackPassage } from "@/lib/explain/explain";
import { ACTIVATIONS, formatNumber, formatOperand } from "@/lib/neuron/neuron";
import { useLesson } from "./LessonProvider";
import type { Passage } from "./SelectionToolbar";

interface Props {
  mode: "explain" | "unpack";
  passage: Passage;
  onClose: () => void;
  /** Jumps the shared diagram to a playback step and scrolls the simulator into view. */
  onShowInDiagram: (step: number) => void;
}

const Disclosure = ({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) => (
  <details open={open}>
    <summary>{title}</summary>
    <div>{children}</div>
  </details>
);

/** Compact panel with a locally generated explanation. It never claims to be an AI model. */
export default function ExplainPanel({ mode, passage, onClose, onShowInDiagram }: Props) {
  const { params: p, result: r } = useLesson();
  const ref = useRef<HTMLElement>(null);
  const explanation = mode === "explain" ? explainPassage(passage, p) : null;
  const unpacked = mode === "unpack" ? unpackPassage(passage, p) : null;

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [mode, passage.text]);

  const quote = passage.text.length > 180 ? `${passage.text.slice(0, 177)}…` : passage.text;

  return (
    <aside ref={ref} className="ep" tabIndex={-1} aria-label={mode === "explain" ? "Explanation" : "Unpacked explanation"}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }} data-no-toolbar data-fr-block>
      <header>
        <h2>{mode === "explain" ? "Explain this" : "Unpack this"}</h2>
        <button type="button" onClick={onClose} aria-label="Close explanation">×</button>
      </header>
      <blockquote>{quote}</blockquote>

      {explanation && (
        <>
          <p>{explanation.simple}</p>
          {explanation.example && <p className="ep-example"><b>Example. </b>{explanation.example}</p>}
        </>
      )}

      {unpacked && (
        <div className="ep-details">
          <Disclosure title="What it means" open><p>{unpacked.meaning}</p></Disclosure>
          {unpacked.terms.length > 0 && (
            <Disclosure title="Key terms">
              <dl>{unpacked.terms.map(([term, def]) => (<div key={term}><dt>{term}</dt><dd>{def}</dd></div>))}</dl>
            </Disclosure>
          )}
          {unpacked.steps.length > 0 && (
            <Disclosure title="Step by step"><ol>{unpacked.steps.map((s) => <li key={s}>{s}</li>)}</ol></Disclosure>
          )}
          {unpacked.formula && <Disclosure title="Formula"><pre>{unpacked.formula}</pre></Disclosure>}
          {unpacked.example && <Disclosure title="Example with your numbers" open><p>{unpacked.example}</p></Disclosure>}
          {unpacked.lead && (
            <Disclosure title="Inspect it in the live model">
              <table>
                <tbody>
                  <tr><th scope="row">x₁ × w₁</th><td>{formatOperand(p.x1)} × {formatOperand(p.w1)}</td><td>= {formatNumber(r.products[0])}</td></tr>
                  <tr><th scope="row">x₂ × w₂</th><td>{formatOperand(p.x2)} × {formatOperand(p.w2)}</td><td>= {formatNumber(r.products[1])}</td></tr>
                  <tr><th scope="row">Weighted sum</th><td>{formatNumber(r.products[0])} + {formatOperand(r.products[1])}</td><td>= {formatNumber(r.sum)}</td></tr>
                  <tr><th scope="row">+ bias</th><td>{formatNumber(r.sum)} + {formatOperand(p.bias)}</td><td>z = {formatNumber(r.z)}</td></tr>
                  <tr><th scope="row">{ACTIVATIONS[p.activation].label}</th><td>f({formatNumber(r.z)})</td><td>a = {formatNumber(r.a)}</td></tr>
                </tbody>
              </table>
              {unpacked.inspectStep !== undefined && (
                <button type="button" onClick={() => onShowInDiagram(unpacked.inspectStep as number)}>Show this step in the diagram</button>
              )}
            </Disclosure>
          )}
        </div>
      )}
      <footer>Generated locally from the lesson’s own notes, not by an AI model, so it only covers this lesson’s concepts.</footer>
    </aside>
  );
}

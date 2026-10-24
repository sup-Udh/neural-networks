"use client";

import { Fragment, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { runUserCode } from "@/lib/sandbox/runUserCode";
import type { RunResult } from "@/lib/sandbox/runUserCode";
import { formatNumber } from "@/lib/neuron/neuron";
import { useLesson } from "./LessonProvider";

const EXAMPLES = {
  sum: {
    label: "Weighted sum",
    code: `function neuron(x1, x2, w1, w2, bias) {
  const weightedSum =
    x1 * w1 + x2 * w2 + bias;

  return weightedSum;
}
`,
  },
  relu: {
    label: "With ReLU",
    code: `function relu(z) {
  return Math.max(0, z);
}

function neuron(x1, x2, w1, w2, bias) {
  const z = x1 * w1 + x2 * w2 + bias;

  return relu(z);
}
`,
  },
  sigmoid: {
    label: "With sigmoid",
    code: `function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function neuron(x1, x2, w1, w2, bias) {
  const z = x1 * w1 + x2 * w2 + bias;

  return sigmoid(z);
}
`,
  },
} as const;
type ExampleId = keyof typeof EXAMPLES;

const TOKEN = /(\/\/.*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\b(function|return|const|let|var|if|else|for|while|true|false|null|undefined|new|of|in)\b|\b(\d+(?:\.\d+)?)\b|\b(Math)\b/g;

/** Splits source into coloured spans. The text content is identical to the input, which keeps the overlay aligned. */
function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of code.matchAll(TOKEN)) {
    const index = m.index ?? 0;
    if (index > last) out.push(<Fragment key={key++}>{code.slice(last, index)}</Fragment>);
    const cls = m[1] ? "tok-comment" : m[2] ? "tok-string" : m[3] ? "tok-keyword" : m[4] ? "tok-number" : "tok-builtin";
    out.push(<span key={key++} className={cls}>{m[0]}</span>);
    last = index + m[0].length;
  }
  out.push(<Fragment key={key++}>{code.slice(last)}</Fragment>);
  return out;
}

export default function CodeEditor() {
  const lesson = useLesson();
  const { params: p, result: r } = lesson;
  const [example, setExample] = useState<ExampleId>("sum");
  const [code, setCode] = useState<string>(EXAMPLES.sum.code);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<{ run: RunResult; args: number[]; z: number; a: number } | null>(null);
  const [notice, setNotice] = useState("");
  const preRef = useRef<HTMLPreElement>(null);
  const escapeTab = useRef(false);
  const hintId = useId();

  const run = async () => {
    if (running) return;
    setRunning(true);
    const args = [p.x1, p.x2, p.w1, p.w2, p.bias];
    const snapshot = { params: p, z: r.z, a: r.a };
    const result = await runUserCode(code, args);
    setRunning(false);
    setOutput({ run: result, args, z: snapshot.z, a: snapshot.a });
    if (result.ok && result.value !== null) {
      const close = (x: number, y: number) => Math.abs(x - y) < 1e-9;
      const matches = close(result.value, snapshot.a) ? "a" : close(result.value, snapshot.z) ? "z" : null;
      lesson.setCodeResult({ value: result.value, matches, params: snapshot.params });
    } else {
      lesson.setCodeResult(null);
    }
  };

  const choose = (id: ExampleId) => {
    setExample(id);
    setCode(EXAMPLES[id].code);
    setOutput(null);
    lesson.setCodeResult(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setNotice("Code copied to the clipboard.");
    } catch {
      setNotice("Copy was blocked by the browser. Select the code and press Ctrl+C instead.");
    }
    window.setTimeout(() => setNotice(""), 2500);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void run();
      return;
    }
    if (event.key === "Escape") {
      escapeTab.current = true;
      return;
    }
    if (event.key === "Tab" && !event.shiftKey && !escapeTab.current) {
      event.preventDefault();
      const el = event.currentTarget;
      const { selectionStart: s, selectionEnd: e } = el;
      setCode(code.slice(0, s) + "  " + code.slice(e));
      requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
    }
    if (event.key !== "Escape" && event.key !== "Tab") escapeTab.current = false;
  };

  const verdict = (() => {
    if (!output || !output.run.ok || output.run.value === null) return null;
    const v = output.run.value;
    const close = (x: number, y: number) => Math.abs(x - y) < 1e-9;
    if (close(v, output.a) && close(output.a, output.z)) return { ok: true, text: `Matches the model: z and a are both ${formatNumber(output.a)} with the identity activation.` };
    if (close(v, output.a)) return { ok: true, text: `Matches the model's output a = ${formatNumber(output.a)}.` };
    if (close(v, output.z)) return { ok: true, text: `Matches the weighted sum z = ${formatNumber(output.z)}. The diagram's output a is ${formatNumber(output.a)} because it applies the ${p.activation} activation.` };
    return { ok: false, text: `Differs from the model. Your code returned ${formatNumber(v)}; the simulator has z = ${formatNumber(output.z)} and a = ${formatNumber(output.a)}.` };
  })();

  return (
    <div className="ce" data-no-toolbar data-fr-busy={running || undefined}>
      <div className="ce-bar">
        <span className="ce-name">neuron.js</span>
        <div className="ce-examples" role="group" aria-label="Example code">
          {(Object.keys(EXAMPLES) as ExampleId[]).map((id) => (
            <button key={id} type="button" aria-pressed={example === id} onClick={() => choose(id)}>{EXAMPLES[id].label}</button>
          ))}
        </div>
      </div>
      <div className="ce-body">
        <pre ref={preRef} className="ce-pre" aria-hidden="true">{highlight(code)}{"\n "}</pre>
        <textarea className="ce-input" value={code} spellCheck={false} autoCapitalize="off" autoCorrect="off" aria-label="JavaScript code editor" aria-describedby={hintId}
          onChange={(e) => setCode(e.target.value)} onKeyDown={onKeyDown}
          onScroll={(e) => { if (preRef.current) { preRef.current.scrollTop = e.currentTarget.scrollTop; preRef.current.scrollLeft = e.currentTarget.scrollLeft; } }} />
      </div>
      <div className="ce-actions">
        <button type="button" className="is-primary" onClick={run} disabled={running}>{running ? "Running…" : "Run code"}</button>
        <button type="button" onClick={() => choose(example)}>Reset to starter</button>
        <button type="button" onClick={copy}>Copy code</button>
        <span id={hintId} className="ce-hint">Ctrl+Enter runs. Esc then Tab leaves the editor.</span>
      </div>
      <div className="ce-output" role="status" aria-live="polite">
        <div className="ce-output-title">Output</div>
        {!output && !running && <p>Press “Run code” to call <code>neuron</code> with your current slider values: x₁ = {formatNumber(p.x1)}, x₂ = {formatNumber(p.x2)}, w₁ = {formatNumber(p.w1)}, w₂ = {formatNumber(p.w2)}, b = {formatNumber(p.bias)}.</p>}
        {running && <p>Running in an isolated worker…</p>}
        {output && !running && (
          <>
            {output.run.ok ? (
              <p className="ce-result">neuron({output.args.map((n) => formatNumber(n)).join(", ")}) → <b>{formatNumber(output.run.value ?? NaN, 6)}</b> <span>({output.run.ms} ms)</span></p>
            ) : (
              <p className="ce-error"><b>{output.run.timedOut ? "Timed out" : "Error"}.</b> {output.run.error}</p>
            )}
            {output.run.logs.length > 0 && <pre className="ce-logs">{output.run.logs.join("\n")}</pre>}
            {verdict && <p className={verdict.ok ? "ce-match" : "ce-differs"}>{verdict.ok ? "✓ " : "≠ "}{verdict.text}</p>}
          </>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">{notice}</p>
      {notice && <p className="ce-notice">{notice}</p>}
    </div>
  );
}

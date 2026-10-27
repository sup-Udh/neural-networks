"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { highlight } from "@/components/lesson/CodeEditor";
import { STARTER_POLICY_CODE } from "@/lib/mario/starter";
import { validatePolicy } from "@/lib/mario/policyWorker";

interface Props {
  draft: string;
  active: string;
  version: number;
  onDraft: (code: string) => void;
  onApply: () => void;
  onReset: () => void;
}

export default function PolicyEditor({ draft, active, version, onDraft, onApply, onReset }: Props) {
  const preRef = useRef<HTMLPreElement>(null);
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = draft !== active;

  const apply = async () => {
    setBusy(true);
    const result = await validatePolicy(draft);
    setBusy(false);
    if (result.ok) {
      onApply();
      setCheck({ ok: true, text: `Valid. On a sample observation decide() returned "${result.action}". Applied as policy v${version + 1}.` });
    } else {
      setCheck({ ok: false, text: `Not applied (policy v${version} stays active): ${result.error}` });
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void apply();
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: s, selectionEnd: end } = el;
      onDraft(draft.slice(0, s) + "  " + draft.slice(end));
      requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
    }
  };

  return (
    <div className="ml-code">
      <div className="ml-code__bar">
        <b>policy.js</b>
        <span className={dirty ? "ml-badge ml-badge--warn" : "ml-badge"}>{dirty ? "unsaved changes (draft ≠ active)" : "draft = active"}</span>
        <span className="ml-badge">active: policy v{version}</span>
      </div>
      <div className="ml-code__body">
        <pre ref={preRef} aria-hidden="true">
          {highlight(draft)}
          {"\n "}
        </pre>
        <textarea
          value={draft}
          spellCheck={false}
          aria-label="Policy code editor"
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={(e) => {
            if (preRef.current) {
              preRef.current.scrollTop = e.currentTarget.scrollTop;
              preRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
          }}
        />
      </div>
      <div className="ml-row">
        <button type="button" className="is-primary" onClick={apply} disabled={busy}>
          {busy ? "Checking…" : "Validate & apply (Ctrl+Enter)"}
        </button>
        <button type="button" onClick={onReset} disabled={draft === STARTER_POLICY_CODE}>
          Reset draft to starter
        </button>
      </div>
      {check && (
        <p className={check.ok ? "ml-ok" : "ml-error"} role="status">
          {check.text}
        </p>
      )}
      <p className="ml-note">
        Policy code picks the action; it does not change the network’s weights (use the Parameters tab). It is plain JavaScript run in a Web Worker with no imports or network access, a 250 ms answer limit, and its return value must be exactly “run”, “jump” or “wait”. A Worker is not a hardened sandbox.
        It only controls Mario in “Policy code” mode.
      </p>
    </div>
  );
}

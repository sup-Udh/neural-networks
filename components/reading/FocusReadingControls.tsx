"use client";

import { FOCUS_DELAY, clampDelaySeconds } from "@/lib/reading/focusReading";
import { focusStore, usePersisted } from "@/lib/storage/stores";
import type { FocusReading } from "./useFocusReadingMode";

/** Header controls: a manual toggle and a compact settings popover. Persists only the two preferences. */
export function FocusReadingControls({ focus }: { focus: FocusReading }) {
  const prefs = usePersisted(focusStore);
  const delays = Array.from({ length: FOCUS_DELAY.max - FOCUS_DELAY.min + 1 }, (_, i) => FOCUS_DELAY.min + i);
  return (
    <div className="fr-controls">
      <button type="button" className="fr-toggle" aria-pressed={focus.active} onClick={focus.toggle} title="Focus reading (Alt+Shift+F)" aria-keyshortcuts="Alt+Shift+F">
        Focus
      </button>
      <details className="fr-settings">
        <summary aria-label="Focus reading settings">⚙</summary>
        <div className="fr-popover">
          <label>
            <input type="checkbox" checked={prefs.auto} onChange={(e) => focusStore.set({ ...prefs, auto: e.target.checked })} />
            Focus automatically when I pause reading
          </label>
          <label>
            After
            <select value={prefs.delaySec} disabled={!prefs.auto} onChange={(e) => focusStore.set({ ...prefs, delaySec: clampDelaySeconds(Number(e.target.value)) })}>
              {delays.map((s) => <option key={s} value={s}>{s} seconds</option>)}
            </select>
            of inactivity
          </label>
          <p>Manual shortcut: <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>. Moving, scrolling or pressing a key leaves focus mode.</p>
        </div>
      </details>
    </div>
  );
}

/** Always-available way out while focus mode is on. Rendered only when active. */
export function FocusReadingExit({ focus }: { focus: FocusReading }) {
  return (
    <>
      {focus.active && (
        <button type="button" className="fr-exit" onClick={focus.exit} aria-label="Exit focus reading mode">
          Exit focus <kbd>Esc</kbd>
        </button>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {focus.state === "focused" ? "Focus reading on. Press Escape to exit." : focus.state === "exiting" ? "Focus reading off." : ""}
      </p>
    </>
  );
}

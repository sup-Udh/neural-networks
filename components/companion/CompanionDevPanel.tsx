"use client";

import { ANIMATION_STATES, COMPANION_SIZES } from "./companionTypes";
import type { AnimationState, CompanionId, CompanionSize } from "./companionTypes";

export interface DevSettings {
  character: CompanionId | null;
  size: CompanionSize;
  reduced: boolean | null;
  paused: boolean;
}

interface CompanionDevPanelProps {
  settings: DevSettings;
  onChange: (next: DevSettings) => void;
  onPlay: (state: AnimationState) => void;
  onReplay: () => void;
}

/** Development-only controls. The caller renders this only outside production builds. */
export default function CompanionDevPanel({ settings, onChange, onPlay, onReplay }: CompanionDevPanelProps) {
  return (
    <details className="companion-dev">
      <summary>Companion dev</summary>
      <div className="companion-dev-body">
        <div className="companion-dev-row">
          {(["rune", "sol"] as const).map((id) => (
            <button key={id} type="button" aria-pressed={settings.character === id} onClick={() => onChange({ ...settings, character: id })}>{id}</button>
          ))}
          <button type="button" aria-pressed={settings.character === null} onClick={() => onChange({ ...settings, character: null })}>saved</button>
        </div>
        <div className="companion-dev-row">
          {ANIMATION_STATES.map((state) => (
            <button key={state} type="button" onClick={() => onPlay(state)}>{state}</button>
          ))}
        </div>
        <div className="companion-dev-row">
          <button type="button" aria-pressed={settings.paused} onClick={() => onChange({ ...settings, paused: !settings.paused })}>{settings.paused ? "resume" : "pause"}</button>
          <button type="button" onClick={onReplay}>replay</button>
          <button
            type="button"
            aria-pressed={settings.reduced === true}
            onClick={() => onChange({ ...settings, reduced: settings.reduced ? null : true })}
          >
            reduced motion
          </button>
        </div>
        <div className="companion-dev-row">
          {COMPANION_SIZES.map((size) => (
            <button key={size} type="button" aria-pressed={settings.size === size} onClick={() => onChange({ ...settings, size })}>{size}px</button>
          ))}
        </div>
      </div>
    </details>
  );
}

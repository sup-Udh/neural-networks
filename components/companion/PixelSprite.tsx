"use client";

import { useEffect, useMemo, useState } from "react";
import { GRID_H, GRID_W, LOOPING, getAnimations } from "./companionAnimations";
import type { AnimationState, CompanionId } from "./companionTypes";

interface PixelSpriteProps {
  character: CompanionId;
  state: AnimationState;
  /** Rendered height in CSS px (the artwork is 24x32 units). */
  size: number;
  /** Show only the first frame and never schedule timers. */
  still?: boolean;
  /** Controlled frame index (used for the phased jump). */
  frame?: number;
  paused?: boolean;
  replayKey?: number;
  /** Playback speed multiplier (walk speeds up into a run). */
  rate?: number;
}

export default function PixelSprite({ character, state, size, still = false, frame, paused = false, replayKey = 0, rate = 1 }: PixelSpriteProps) {
  const frames = useMemo(() => getAnimations(character)[state], [character, state]);
  const [index, setIndex] = useState(0);
  const [lastReset, setLastReset] = useState({ state, replayKey });

  // Restart from the first frame when the state or replay token changes.
  if (lastReset.state !== state || lastReset.replayKey !== replayKey) {
    setLastReset({ state, replayKey });
    setIndex(0);
  }

  const controlled = frame !== undefined;
  useEffect(() => {
    if (still || controlled || paused || frames.length < 2) return;
    const current = frames[index];
    const timer = window.setTimeout(() => {
      if (index + 1 < frames.length) setIndex(index + 1);
      else if (LOOPING[state]) setIndex(0);
    }, (current ? current.ms : 200) / rate);
    return () => window.clearTimeout(timer);
  }, [still, controlled, paused, frames, index, state, rate]);

  const at = still ? 0 : controlled ? Math.min(frame, frames.length - 1) : Math.min(index, frames.length - 1);
  const shown = frames[at];
  return (
    <svg
      className="pixel-sprite"
      viewBox={`0 0 ${GRID_W} ${GRID_H}`}
      width={Math.round((size * GRID_W) / GRID_H)}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {shown?.pixels.map(([x, y, w, h, color], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={color} />
      ))}
    </svg>
  );
}

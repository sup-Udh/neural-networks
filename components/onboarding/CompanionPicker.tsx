"use client";

import { useState } from "react";
import Link from "next/link";

type CompanionId = "rune" | "sol";
type Pixel = readonly [x: number, y: number, width: number, height: number, color: string];

const portraits: Record<CompanionId, Pixel[]> = {
  rune: [
    [3, 1, 10, 4, "#a0522d"], [2, 3, 3, 4, "#8c3e1e"], [11, 3, 3, 4, "#8c3e1e"],
    [4, 4, 8, 8, "#f8d5b8"], [5, 6, 2, 2, "#2d1d13"], [9, 6, 2, 2, "#2d1d13"],
    [6, 6, 1, 1, "#ffffff"], [10, 6, 1, 1, "#ffffff"], [7, 9, 2, 1, "#d97f64"],
    [6, 10, 4, 1, "#a04328"], [4, 12, 8, 3, "#f4ebd9"], [6, 12, 4, 2, "#f3701e"],
  ],
  sol: [
    [3, 1, 10, 4, "#1b4958"], [2, 3, 3, 4, "#11303a"], [11, 3, 3, 4, "#11303a"],
    [4, 4, 8, 8, "#efd1ba"], [4, 5, 3, 1, "#11303a"], [9, 5, 3, 1, "#11303a"],
    [5, 6, 2, 2, "#182c35"], [9, 6, 2, 2, "#182c35"], [6, 6, 1, 1, "#7fa5d8"],
    [10, 6, 1, 1, "#7fa5d8"], [7, 9, 2, 1, "#cf7f6b"], [4, 12, 8, 3, "#2d3748"],
    [7, 12, 2, 3, "#f3ece3"],
  ],
};

const sprites: Record<CompanionId, Pixel[]> = {
  rune: [
    [8, 2, 8, 4, "#a0522d"], [6, 4, 3, 5, "#8c3e1e"], [15, 4, 3, 5, "#8c3e1e"],
    [7, 2, 2, 1, "#bc6a42"], [8, 5, 8, 6, "#f8d5b8"], [9, 7, 2, 2, "#241b17"],
    [13, 7, 2, 2, "#241b17"], [9, 7, 1, 1, "#ffffff"], [13, 7, 1, 1, "#ffffff"],
    [10, 9, 4, 1, "#d8846c"], [8, 11, 8, 2, "#f3701e"], [13, 13, 2, 3, "#d9580b"],
    [5, 12, 3, 7, "#6d4c3d"], [4, 14, 2, 4, "#f3701e"], [16, 13, 2, 5, "#543729"],
    [8, 13, 8, 7, "#f3ece3"], [7, 13, 2, 6, "#e0d6cb"], [15, 13, 2, 6, "#e0d6cb"],
    [9, 14, 2, 6, "#7fa5d8"], [13, 14, 2, 6, "#7fa5d8"], [8, 19, 8, 2, "#354a68"],
    [11, 19, 2, 2, "#f3701e"], [6, 18, 2, 3, "#f8d5b8"], [16, 18, 2, 3, "#f8d5b8"],
    [8, 21, 3, 6, "#2d3748"], [13, 21, 3, 6, "#2d3748"], [7, 27, 4, 3, "#4a2e1b"],
    [13, 27, 4, 3, "#4a2e1b"], [7, 29, 5, 1, "#24140b"], [13, 29, 5, 1, "#24140b"],
  ],
  sol: [
    [7, 2, 10, 4, "#1b4958"], [5, 3, 3, 5, "#11303a"], [15, 4, 3, 6, "#11303a"],
    [6, 2, 3, 1, "#2d6e85"], [8, 5, 8, 6, "#efd1ba"], [8, 6, 3, 1, "#11303a"],
    [13, 6, 3, 1, "#11303a"], [9, 7, 2, 2, "#182c35"], [13, 7, 2, 2, "#182c35"],
    [10, 7, 1, 1, "#7fa5d8"], [14, 7, 1, 1, "#7fa5d8"], [10, 9, 4, 1, "#c47864"],
    [7, 11, 10, 9, "#27323f"], [9, 11, 6, 4, "#3b4b5e"], [11, 12, 2, 6, "#f3ece3"],
    [10, 15, 4, 1, "#f3ece3"], [5, 13, 2, 6, "#27323f"], [5, 19, 3, 3, "#efd1ba"],
    [17, 13, 2, 5, "#27323f"], [16, 18, 3, 2, "#f3701e"], [17, 18, 1, 1, "#ffffff"],
    [16, 20, 2, 2, "#efd1ba"], [7, 20, 10, 2, "#1a202c"], [8, 20, 2, 3, "#4a5568"],
    [14, 20, 2, 3, "#4a5568"], [8, 22, 3, 5, "#1e2631"], [13, 22, 3, 5, "#1e2631"],
    [7, 27, 4, 3, "#111827"], [13, 27, 4, 3, "#111827"], [7, 29, 5, 1, "#374151"],
    [13, 29, 5, 1, "#374151"],
  ],
};

function PixelArt({ companion, portrait = false }: { companion: CompanionId; portrait?: boolean }) {
  const source = portrait ? portraits[companion] : sprites[companion];
  const size = portrait ? "0 0 16 16" : "0 0 24 32";
  return (
    <svg className={portrait ? "companion-portrait" : "companion-sprite"} viewBox={size} aria-hidden="true" shapeRendering="crispEdges">
      {source.map(([x, y, width, height, color], index) => (
        <rect key={`${companion}-${index}`} x={x} y={y} width={width} height={height} fill={color} />
      ))}
    </svg>
  );
}

const companions = {
  rune: {
    name: "Rune, The Explorer",
    code: "EXP-01",
    archetype: "Scout archetype",
    nature: "Curious & Resourceful",
    description: "Curious by nature. Always ready to test an idea, follow a signal, and discover what happens next.",
    traits: ["Curious", "Resourceful"],
  },
  sol: {
    name: "Sol, The Builder",
    code: "BLD-02",
    archetype: "Architect archetype",
    nature: "Inventive & Analytical",
    description: "Always asking why. Break down complex systems, experiment with the pieces, and turn ideas into working models.",
    traits: ["Inventive", "Analytical"],
  },
} satisfies Record<CompanionId, { name: string; code: string; archetype: string; nature: string; description: string; traits: string[] }>;

function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <span className={`companion-status ${selected ? "is-selected" : ""}`}>
      <span className="status-light" />{selected ? "Selected" : "Select"}
    </span>
  );
}

export default function CompanionPicker() {
  const [selected, setSelected] = useState<CompanionId | null>(null);

  return (
    <>
      <div className="companion-grid" role="group" aria-label="Choose your NeuralArc companion">
        {(Object.keys(companions) as CompanionId[]).map((id) => {
          const companion = companions[id];
          const isSelected = selected === id;
          return (
            <button
              className={`companion-card ${isSelected ? "companion-card-selected" : ""}`}
              type="button"
              key={id}
              aria-pressed={isSelected}
              onClick={() => setSelected(id)}
            >
              <SelectionMark selected={isSelected} />
              <span className="companion-halo" aria-hidden="true" />
              <span className="companion-card-inner">
                <span className="companion-stage">
                  <span className="portrait-tag">
                    <PixelArt companion={id} portrait />
                    <span><small>Portrait</small><strong>{id}</strong></span>
                  </span>
                  <span className={`sprite-wrapper ${isSelected ? "sprite-idle" : ""}`}>
                    <PixelArt companion={id} />
                  </span>
                  <span className="sprite-shadow" />
                </span>
                <span className="companion-details">
                  <span className="companion-meta"><span>{companion.code}</span><i>/</i>{companion.archetype}</span>
                  <span className="companion-name">{companion.name}</span>
                  <span className="companion-nature">{companion.nature}</span>
                  <span className="companion-description">{companion.description}</span>
                  <span className="companion-traits">
                    {companion.traits.map((trait) => <span key={trait}>[{trait}]</span>)}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="companion-action">
        {selected ? (
          <Link className="companion-continue" href="/#playground">
            Enter the World as {selected === "rune" ? "Rune" : "Sol"}
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-5-5 5 5-5 5" /></svg>
          </Link>
        ) : (
          <span className="companion-continue companion-continue-disabled" aria-disabled="true">
            Choose a companion to continue
          </span>
        )}
        <p><span aria-hidden="true">✓</span>Your character is cosmetic. Every path leads to discovery.</p>
      </div>
    </>
  );
}

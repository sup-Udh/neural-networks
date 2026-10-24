"use client";

import { useState } from "react";
import Link from "next/link";
import type { CompanionId } from "@/components/companion/companionTypes";
import { portraits, sprites } from "@/components/companion/spriteData";
import { saveCompanion } from "@/components/companion/companionStore";

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
          <Link className="companion-continue" href="/learn/docs" onClick={() => saveCompanion(selected)}>
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

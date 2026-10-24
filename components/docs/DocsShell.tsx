"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import NeuralBackground from "@/components/landing/NeuralBackground";
import CompanionDevPanel from "@/components/companion/CompanionDevPanel";
import type { DevSettings } from "@/components/companion/CompanionDevPanel";
import PixelCompanion from "@/components/companion/PixelCompanion";
import type { AnimationState, PixelCompanionHandle } from "@/components/companion/companionTypes";
import { useSavedCompanion } from "@/components/companion/companionStore";
import { useActiveSection } from "@/components/companion/useActiveSection";
import DocsArticle, { SECTIONS } from "./DocsArticle";

const SECTION_IDS = SECTIONS.map((section) => section.id);
const SHOW_DEV_PANEL = process.env.NODE_ENV !== "production";

export default function DocsShell() {
  const saved = useSavedCompanion();
  const stageRef = useRef<HTMLElement>(null);
  const companionRef = useRef<PixelCompanionHandle>(null);
  const activeId = useActiveSection(SECTION_IDS);
  const [dev, setDev] = useState<DevSettings>({ character: null, size: 24, reduced: null, paused: false });
  const [replayKey, setReplayKey] = useState(0);

  const character = dev.character ?? saved ?? null;
  const play = (state: AnimationState) => companionRef.current?.play(state);

  return (
    <div className="docs-page">
      <NeuralBackground variant="onboarding" />
      <header className="docs-header">
        <Link className="brand-lockup" href="/" aria-label="NeuralArc home">
          <span>Neural<span>Arc</span></span>
        </Link>
        <span className="docs-header-path">Field guide / Neural networks</span>
        <Link className="docs-header-link" href="/get-started">Change companion</Link>
      </header>

      <div className="docs-layout">
        <nav className="docs-rail" aria-label="Documentation sections">
          <p className="docs-rail-title">On this page</p>
          <ol>
            {SECTIONS.map((section, index) => (
              <li key={section.id}>
                <a href={`#${section.id}`} aria-current={activeId === section.id ? "location" : undefined}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main
          className="docs-stage"
          ref={stageRef}
          onPointerDown={(event) => {
            const control = (event.target as Element).closest("[data-companion-inspect]");
            if (control) companionRef.current?.inspect(control);
          }}
        >
          <DocsArticle onCelebrate={() => companionRef.current?.celebrate()} />
          {saved === null && !dev.character && (
            <p className="docs-no-companion" role="note">
              No companion selected yet. <Link href="/get-started">Choose one</Link> to have it explore this guide with you.
            </p>
          )}
          {character && (
            <PixelCompanion
              ref={companionRef}
              character={character}
              size={dev.size}
              stageRef={stageRef}
              sectionIds={SECTION_IDS}
              activeId={activeId}
              contentSelector="[data-docs-content]"
              reducedMotion={dev.reduced ?? undefined}
              paused={dev.paused}
              replayKey={replayKey}
            />
          )}
        </main>
      </div>

      {SHOW_DEV_PANEL && (
        <CompanionDevPanel settings={dev} onChange={setDev} onPlay={play} onReplay={() => setReplayKey((k) => k + 1)} />
      )}
    </div>
  );
}

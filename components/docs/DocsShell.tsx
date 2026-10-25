"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import NeuralBackground from "@/components/landing/NeuralBackground";
import CompanionDevPanel from "@/components/companion/CompanionDevPanel";
import type { DevSettings } from "@/components/companion/CompanionDevPanel";
import PixelCompanion from "@/components/companion/PixelCompanion";
import type { AnimationState, PixelCompanionHandle } from "@/components/companion/companionTypes";
import { useSavedCompanion } from "@/components/companion/companionStore";
import { useActiveSection } from "@/components/companion/useActiveSection";
import { useMediaQuery } from "@/components/companion/useMediaQuery";
import { useTextSelection } from "@/components/companion/useTextSelection";
import ExplainPanel from "@/components/lesson/ExplainPanel";
import { LessonProvider, useLesson } from "@/components/lesson/LessonProvider";
import NotesWidget from "@/components/lesson/NotesWidget";
import SelectionToolbar from "@/components/lesson/SelectionToolbar";
import type { Passage } from "@/components/lesson/SelectionToolbar";
import { flashPassage } from "@/components/lesson/flashPassage";
import { FocusReadingControls, FocusReadingExit } from "@/components/reading/FocusReadingControls";
import { useFocusReadingMode } from "@/components/reading/useFocusReadingMode";
import { READ_SCALE, addNote, focusStore, prefsStore, usePersisted } from "@/lib/storage/stores";
import type { Note } from "@/lib/storage/stores";
import DocsArticle, { SECTIONS, sectionTitle } from "./DocsArticle";

const SECTION_IDS = SECTIONS.map((section) => section.id);
const SHOW_DEV_PANEL = process.env.NODE_ENV !== "production";
const NO_TOOLBAR = "[data-no-toolbar]";

function ReadingZoom() {
  const { readScale } = usePersisted(prefsStore);
  const set = (value: number) => prefsStore.set({ readScale: Math.min(READ_SCALE.max, Math.max(READ_SCALE.min, value)) });
  return (
    <div className="rz" role="group" aria-label="Reading size">
      <button type="button" onClick={() => set(readScale - READ_SCALE.step)} disabled={readScale <= READ_SCALE.min} aria-label="Decrease reading size">A−</button>
      <output aria-live="polite" aria-label="Current reading size">{readScale}%</output>
      <button type="button" onClick={() => set(readScale + READ_SCALE.step)} disabled={readScale >= READ_SCALE.max} aria-label="Increase reading size">A+</button>
      <button type="button" onClick={() => set(READ_SCALE.base)} disabled={readScale === READ_SCALE.base} aria-label="Reset reading size to 100 percent">Reset</button>
    </div>
  );
}

function DocsView() {
  const lesson = useLesson();
  const saved = useSavedCompanion();
  const { readScale } = usePersisted(prefsStore);
  const stageRef = useRef<HTMLElement>(null);
  const companionRef = useRef<PixelCompanionHandle>(null);
  const activeId = useActiveSection(SECTION_IDS);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [dev, setDev] = useState<DevSettings>({ character: null, size: 36, reduced: null, paused: false });
  const [replayKey, setReplayKey] = useState(0);
  const [panel, setPanel] = useState<{ mode: "explain" | "unpack"; passage: Passage } | null>(null);
  const [toast, setToast] = useState("");
  const [savedPulse, setSavedPulse] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const toastTimer = useRef(0);
  const focusPrefs = usePersisted(focusStore);
  const focus = useFocusReadingMode({ auto: focusPrefs.auto, delayMs: focusPrefs.delaySec * 1000, reducedMotion: dev.reduced ?? reduced });

  const character = dev.character ?? saved ?? null;
  const play = (state: AnimationState) => companionRef.current?.play(state);
  const selection = useTextSelection("[data-docs-content]", true, NO_TOOLBAR);

  const say = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  useEffect(() => {
    try { window.localStorage.setItem("neuralarc:v1:last-lesson", "neuron-basics"); } catch { /* Storage may be unavailable. */ }
  }, []);

  const clearSelection = () => window.getSelection()?.removeAllRanges();
  const fallbackSection = (p: Passage) => p.sectionId || activeId || SECTION_IDS[0];

  const save = (passage: Passage) => {
    const added = addNote(passage.text, fallbackSection(passage));
    if (added) {
      companionRef.current?.celebrate(null);
      setSavedPulse((n) => n + 1);
      say("Saved to notes.");
    } else {
      say("That passage is already in your notes.");
    }
    clearSelection();
  };

  const copy = async (passage: Passage) => {
    try {
      await navigator.clipboard.writeText(passage.text);
      say("Copied to the clipboard.");
    } catch {
      say("Copy was blocked by the browser. Use Ctrl+C instead.");
    }
  };

  const openNote = (note: Note) => {
    if (!flashPassage(note.sectionId, note.text, !reduced)) say("The original passage could not be found, so I jumped to its section.");
  };

  const showInDiagram = (step: number) => {
    lesson.gotoStep(step);
    document.getElementById("computation")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="docs-page">
      <NeuralBackground variant="onboarding" />
      <header className="docs-header">
        <Link className="brand-lockup" href="/" aria-label="NeuralArc home">
          <span>Neural<span>Arc</span></span>
        </Link>
        <Link className="docs-header-link" href="/world">← The Neural Frontier</Link>
        <span className="docs-header-path">Field guide / Neural networks / Lesson 01</span>
        <ReadingZoom />
        <FocusReadingControls focus={focus} />
        <Link className="docs-header-link" href="/get-started">Change companion</Link>
      </header>

      <details className="docs-mobile-nav" open={navOpen} onToggle={(e) => setNavOpen(e.currentTarget.open)}>
        <summary>Sections{activeId ? ` · ${sectionTitle(activeId)}` : ""}</summary>
        <ol>
          {SECTIONS.map((section, index) => (
            <li key={section.id}><a href={`#${section.id}`} onClick={() => setNavOpen(false)}>{String(index + 1).padStart(2, "0")} {section.short}</a></li>
          ))}
        </ol>
      </details>

      <div className="docs-layout">
        <nav className="docs-rail" aria-label="Lesson sections">
          <p className="docs-rail-title">On this page</p>
          <ol>
            {SECTIONS.map((section, index) => (
              <li key={section.id}>
                <a href={`#${section.id}`} aria-current={activeId === section.id ? "location" : undefined}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {section.short}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main
          className="docs-stage"
          ref={stageRef}
          style={{ "--read-scale": readScale / 100 } as CSSProperties}
          onPointerDown={(event) => {
            const control = (event.target as Element).closest("[data-companion-inspect]");
            if (control) companionRef.current?.inspect(control);
          }}
        >
          <DocsArticle activeId={activeId} onCelebrate={() => companionRef.current?.celebrate("Challenge complete!")} />
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
              selectionPrompt={false}
              selectionExclude={NO_TOOLBAR}
              suspended={focus.active}
              reducedMotion={dev.reduced ?? undefined}
              paused={dev.paused}
              replayKey={replayKey}
            />
          )}
        </main>
      </div>

      <SelectionToolbar
        selection={selection}
        onExplain={(passage) => setPanel({ mode: "explain", passage: { ...passage, sectionId: fallbackSection(passage) } })}
        onUnpack={(passage) => setPanel({ mode: "unpack", passage: { ...passage, sectionId: fallbackSection(passage) } })}
        onSave={save}
        onCopy={copy}
      />
      {panel && <ExplainPanel mode={panel.mode} passage={panel.passage} onClose={() => setPanel(null)} onShowInDiagram={showInDiagram} />}
      <NotesWidget titleOf={sectionTitle} onOpenNote={openNote} onMessage={say} savedPulse={savedPulse} />
      <FocusReadingExit focus={focus} />
      <p className={`docs-toast ${toast ? "is-visible" : ""}`} role="status" aria-live="polite">{toast}</p>

      {SHOW_DEV_PANEL && (
        <CompanionDevPanel settings={dev} onChange={setDev} onPlay={play} onReplay={() => setReplayKey((k) => k + 1)} />
      )}
    </div>
  );
}

export default function DocsShell() {
  return (
    <LessonProvider>
      <DocsView />
    </LessonProvider>
  );
}

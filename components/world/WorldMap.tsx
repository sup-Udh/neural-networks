"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { PixelPortrait } from "@/components/companion/PixelSprite";
import { useSavedCompanion } from "@/components/companion/companionStore";
import type { CompanionId } from "@/components/companion/companionTypes";
import { progressStore, usePersisted } from "@/lib/storage/stores";
import { REGIONS, STOPS, WORLD_SIZE } from "@/lib/world/worldMap";
import type { Point, Region, RegionId } from "@/lib/world/worldMap";
import { WorldScene } from "@/lib/world/worldScene";
import type { SceneSnapshot } from "@/lib/world/worldScene";

type Status = "available" | "in-progress" | "completed" | "upcoming";

const VIEW_KEY = "neuralarc:v2:world-view";
const LAST_LESSON_KEY = "neuralarc:v1:last-lesson";
const LESSON_HREF = "/learn/docs?lesson=neuron-basics&from=world";
const STATUS_LABEL: Record<Status, string> = { available: "available", "in-progress": "in progress", completed: "completed", upcoming: "coming soon" };
const PAN_STEP = 28;

interface SavedView { player: Point; cam: Point; zoom: number; selected: RegionId | null }

const finitePoint = (p: unknown): p is Point => !!p && Number.isFinite((p as Point).x) && Number.isFinite((p as Point).y);

function readView(): SavedView | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(VIEW_KEY) || "null") as Partial<SavedView> | null;
    if (!raw || !finitePoint(raw.player) || !finitePoint(raw.cam)) return null;
    const inside = (p: Point) => p.x >= 0 && p.y >= 0 && p.x <= WORLD_SIZE && p.y <= WORLD_SIZE;
    if (!inside(raw.player) || !inside(raw.cam)) return null;
    return {
      player: raw.player,
      cam: raw.cam,
      zoom: typeof raw.zoom === "number" ? raw.zoom : 2,
      selected: REGIONS.some((r) => r.id === raw.selected) ? (raw.selected as RegionId) : null,
    };
  } catch {
    return null;
  }
}

export default function WorldMap() {
  const router = useRouter();
  const savedCompanion = useSavedCompanion();
  const progress = usePersisted(progressStore);
  const explorer: CompanionId = savedCompanion ?? "rune";
  const completed = progress.challengeComplete;

  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<WorldScene | null>(null);
  const labelRefs = useRef<Partial<Record<RegionId, HTMLButtonElement | null>>>({});
  const drag = useRef<{ pointer: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null);
  const lastSaved = useRef("");

  const [selected, setSelected] = useState<RegionId | null>(null);
  const [lessonStarted, setLessonStarted] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  const [manualReduced, setManualReduced] = useState(false);
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [ready, setReady] = useState(false);
  const [assetWarning, setAssetWarning] = useState(false);
  const [zoom, setZoom] = useState(2);
  const reducedMotion = systemReduced || manualReduced;

  const statusOf = useCallback(
    (id: RegionId): Status => (id !== "grove" ? "upcoming" : completed ? "completed" : lessonStarted ? "in-progress" : "available"),
    [completed, lessonStarted],
  );

  // The map owns the whole viewport only while it is the active page. A class (not :has) is needed because
  // Next may keep this page mounted but hidden after navigating away, which must give scrolling back.
  useLayoutEffect(() => {
    document.body.classList.add("world-open");
    return () => document.body.classList.remove("world-open");
  }, []);

  // Preferences read from the browser, kept out of the first render so server and client markup match.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setSystemReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    let timer = 0;
    try {
      timer = window.setTimeout(() => setLessonStarted(window.localStorage.getItem(LAST_LESSON_KEY) === "neuron-basics"), 0);
    } catch {
      /* storage unavailable */
    }
    return () => {
      query.removeEventListener("change", sync);
      window.clearTimeout(timer);
    };
  }, []);

  const snapshot = useCallback((): SceneSnapshot => ({
    selected,
    character: explorer,
    reducedMotion,
    statusByRegion: Object.fromEntries(REGIONS.map((r) => [r.id, statusOf(r.id)])) as SceneSnapshot["statusByRegion"],
  }), [selected, explorer, reducedMotion, statusOf]);
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const saveView = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const view: SavedView = { player: scene.player, cam: scene.cam, zoom: scene.zoom, selected: snapshotRef.current().selected };
    const text = JSON.stringify({ ...view, player: { x: Math.round(view.player.x), y: Math.round(view.player.y) }, cam: { x: Math.round(view.cam.x), y: Math.round(view.cam.y) } });
    if (text === lastSaved.current) return;
    lastSaved.current = text;
    try {
      window.localStorage.setItem(VIEW_KEY, text);
    } catch {
      /* the map still works without storage */
    }
  }, []);

  // Create the scene once the canvas exists.
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const saved = readView();
    const start = saved?.player ?? STOPS.grove;
    let scene: WorldScene;
    try {
      scene = new WorldScene(canvas, snapshotRef.current(), start, {
        onFrame: (s) => {
          for (const region of REGIONS) {
            const label = labelRefs.current[region.id];
            if (!label) continue;
            const p = s.worldToCss({ x: region.anchor.x, y: region.anchor.y - 74 });
            const visible = p.x > -80 && p.y > -30 && p.x < stage.clientWidth + 80 && p.y < stage.clientHeight + 30;
            label.style.transform = `translate(${Math.round(Math.min(stage.clientWidth - 70, Math.max(70, p.x)))}px, ${Math.round(Math.max(34, p.y))}px) translate(-50%, -100%)`;
            label.style.visibility = visible ? "visible" : "hidden";
          }
        },
      });
    } catch {
      // Canvas unavailable: tell the user once, after the effect has finished.
      const warn = window.setTimeout(() => setAssetWarning(true), 0);
      return () => window.clearTimeout(warn);
    }
    sceneRef.current = scene;
    const fit = () => {
      const rect = stage.getBoundingClientRect();
      scene.resize(rect.width, rect.height, window.devicePixelRatio || 1);
    };
    // On narrow screens start closer to the character at 2x; the overview button zooms out to 1x.
    scene.setZoom(saved?.zoom ?? 2);
    setZoom(scene.zoom);
    fit();
    scene.focus(saved?.cam ?? start, true);
    if (saved?.selected) setSelected(saved.selected);
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    let cancelled = false;
    scene.load().then(() => {
      if (cancelled) return;
      if (scene.failed) setAssetWarning(true);
      setReady(true);
      scene.markDirty();
    });
    scene.start();
    const persist = window.setInterval(saveView, 1500);
    const onHide = () => saveView();
    window.addEventListener("pagehide", onHide);
    return () => {
      cancelled = true;
      saveView();
      window.clearInterval(persist);
      window.removeEventListener("pagehide", onHide);
      observer.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [saveView]);

  // Keep the scene in step with React state (selection, character, motion preference, progress).
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.snapshot = snapshot();
    scene.markDirty();
  }, [snapshot]);

  const select = useCallback((id: RegionId) => {
    const scene = sceneRef.current;
    const region = REGIONS.find((r) => r.id === id);
    if (!scene || !region) return;
    setSelected(id);
    scene.snapshot = { ...snapshotRef.current(), selected: id };
    // On narrow screens the details panel covers the lower half, so aim the camera above the landmark.
    const stage = stageRef.current;
    const lift = stage && stage.clientWidth <= 760 ? (stage.clientHeight * 0.24) / scene.pixelSize : 0;
    scene.focus({ x: region.anchor.x, y: region.anchor.y + 10 + lift });
    scene.walkTo(region.stop);
    saveView();
  }, [saveView]);

  const showOverview = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    setSelected(null);
    scene.snapshot = { ...snapshotRef.current(), selected: null };
    scene.setZoom(1);
    setZoom(1);
    scene.focus({ x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 }, true);
    saveView();
  };
  const returnHome = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setZoom(2);
    setZoom(2);
    select("grove");
  };
  const changeZoom = (delta: number) => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setZoom(scene.zoom + delta);
    setZoom(scene.zoom);
    saveView();
  };

  const startLesson = () => {
    try {
      window.localStorage.setItem(LAST_LESSON_KEY, "neuron-basics");
    } catch {
      /* navigation still works */
    }
    router.push(LESSON_HREF);
  };

  /* --------------------------------------------------------------------------------- pointer and keyboard */

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button,a,input,.destination-panel,.world-map-controls,.world-popover,.world-sr-destinations")) return;
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (Math.abs(event.clientX - current.startX) + Math.abs(event.clientY - current.startY) > 5) {
      current.moved = true;
      setIsDragging(true);
    }
    if (current.moved) sceneRef.current?.pan(event.clientX - current.x, event.clientY - current.y);
    current.x = event.clientX;
    current.y = event.clientY;
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (!current.moved) {
      const hit = sceneRef.current?.hitTest(event.clientX, event.clientY);
      if (hit) select(hit.id);
    } else saveView();
    drag.current = null;
    setIsDragging(false);
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const scene = sceneRef.current;
    if (!scene || (event.target as HTMLElement).closest("button,a,input")) return;
    const step = PAN_STEP * scene.pixelSize;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[event.key]) {
      event.preventDefault();
      scene.pan(...moves[event.key]);
    } else if (event.key === "+" || event.key === "=") changeZoom(1);
    else if (event.key === "-") changeZoom(-1);
    else if (event.key === "Home") returnHome();
    else if (event.key === "Escape") setSelected(null);
  };

  const active: Region | null = selected ? (REGIONS.find((r) => r.id === selected) ?? null) : null;
  const activeStatus = active ? statusOf(active.id) : null;

  return (
    <main className={`world-app ${reducedMotion ? "reduced-motion" : ""}`}>
      <header className="world-header">
        <Link href="/" className="world-brand" aria-label="NeuralArc home">Neural<span>Arc</span></Link>
        <span className="world-heading"><b>THE NEURAL FRONTIER</b><small>Overworld</small></span>
        <Link href="/get-started" className="world-header-character" aria-label={`Traveling with ${explorer}. Change companion`}>
          <PixelPortrait character={explorer} scale={2} />
          <span>{explorer}</span>
        </Link>
        <div className="world-progress" aria-label={`${completed ? 1 : 0} of 1 available lessons completed`}>
          <span>{completed ? 1 : 0}<i>/ 1 lesson</i></span>
          <b><span style={{ width: completed ? "100%" : "0%" }} /></b>
        </div>
        <button className="world-header-action" type="button" onClick={startLesson}>
          {completed ? "Review lesson" : lessonStarted ? "Resume lesson" : "Start learning"}<span aria-hidden="true">↗</span>
        </button>
        <button className="world-menu-button" type="button" onClick={() => setDestinationsOpen((v) => !v)} aria-expanded={destinationsOpen} aria-label="Choose a destination">Destinations</button>
        <button className="world-settings-button" type="button" onClick={() => setSettingsOpen((v) => !v)} aria-expanded={settingsOpen} aria-label="Map settings">Settings</button>
        {destinationsOpen && (
          <nav className="world-popover world-destinations" aria-label="Learning destinations">
            {REGIONS.map((region) => (
              <button key={region.id} type="button" onClick={() => { select(region.id); setDestinationsOpen(false); }}>
                <span>{region.number}</span><b>{region.name}</b><small>{STATUS_LABEL[statusOf(region.id)]}</small>
              </button>
            ))}
          </nav>
        )}
        {settingsOpen && (
          <div className="world-popover world-settings">
            <button type="button" onClick={() => { showOverview(); setSettingsOpen(false); }}>Show whole map</button>
            <button type="button" onClick={() => { returnHome(); setSettingsOpen(false); }}>Return to Neuron Grove</button>
            <label><input type="checkbox" checked={reducedMotion} disabled={systemReduced} onChange={(e) => setManualReduced(e.target.checked)} />Reduce movement</label>
          </div>
        )}
      </header>

      <section
        className={`world-stage ${isDragging ? "is-dragging" : ""}`}
        ref={stageRef}
        tabIndex={0}
        aria-label="Explore the Neural Frontier. Drag to pan, arrow keys to move the view, plus and minus to zoom."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; setIsDragging(false); }}
        onKeyDown={onKeyDown}
      >
        <canvas ref={canvasRef} className="world-canvas" role="img" aria-label="A top-down pixel-art landscape: a river along the left edge and across the north, a wooden bridge, dirt trails, forests, mountains with a cave, a stone tower, a castle, houses and a pond. Five learning landmarks are marked." />
        {!ready && !assetWarning && <p className="world-loading" role="status">Painting the world…</p>}
        {assetWarning && <p className="world-loading world-warning" role="status">Some artwork could not load. The map is still usable.</p>}
        {REGIONS.map((region) => (
          <button
            key={region.id}
            ref={(el) => { labelRefs.current[region.id] = el; }}
            type="button"
            className={`world-label status-${statusOf(region.id)} ${selected === region.id ? "is-selected" : ""}`}
            aria-label={`${region.name}, ${STATUS_LABEL[statusOf(region.id)]}`}
            aria-pressed={selected === region.id}
            onClick={() => select(region.id)}
            style={{ visibility: "hidden" }}
          >
            <i aria-hidden="true">{region.number}</i>{region.name}
          </button>
        ))}
        <div className="world-map-controls">
          <button type="button" onClick={showOverview}>World view</button>
          <button type="button" onClick={returnHome}>Starting area</button>
          <button type="button" onClick={() => changeZoom(-1)} disabled={zoom <= 1} aria-label="Zoom out">−</button>
          <button type="button" onClick={() => changeZoom(1)} disabled={zoom >= 4} aria-label="Zoom in">+</button>
        </div>
        {active && activeStatus && (
          <aside className="destination-panel" aria-label={`${active.name} details`}>
            <button className="panel-close" type="button" aria-label="Close destination details" onClick={() => setSelected(null)}>Close</button>
            <div className="panel-eyebrow">REGION {active.number}<span> / </span>{active.id === "grove" ? "AVAILABLE" : "FRONTIER"}</div>
            <h1>{active.name}</h1>
            <p>{active.description}</p>
            <div className="panel-topics-label">{active.lessonIds.length ? "YOU'LL EXPLORE" : "ON THE TRAIL"}</div>
            <div className="panel-topics">{active.topics.map((topic) => <span key={topic}>{topic}</span>)}</div>
            <div className={`panel-status status-${activeStatus === "upcoming" ? "coming-soon" : activeStatus}`}>
              <i aria-hidden="true">{activeStatus === "completed" ? "✓" : active.id === "grove" ? "01" : "…"}</i>
              <span>{active.id === "grove" ? (completed ? "Lesson complete" : lessonStarted ? "Your lesson is in progress" : "Ready when you are") : "These lessons are still being built."}</span>
            </div>
            {active.id === "grove" ? (
              <button className="panel-action" type="button" onClick={startLesson}>
                {completed ? "Review lesson" : lessonStarted ? "Continue learning" : "Start learning"}<span aria-hidden="true">→</span>
              </button>
            ) : (
              <button className="panel-action is-upcoming" type="button" disabled>Coming soon</button>
            )}
          </aside>
        )}
        <p className="world-canvas-description" aria-live="polite">
          {active ? `${active.name}. ${STATUS_LABEL[statusOf(active.id)]}. ${active.description}` : "Use the destination menu or the landmark buttons to explore."}
        </p>
      </section>
    </main>
  );
}

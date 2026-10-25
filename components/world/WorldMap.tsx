"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import PixelSprite from "@/components/companion/PixelSprite";
import { useSavedCompanion } from "@/components/companion/companionStore";
import { progressStore, usePersisted } from "@/lib/storage/stores";
import { REGIONS, WAYPOINTS, WORLD } from "@/lib/world/mapData";
import type { PointerEvent as ReactPointerEvent } from "react";

type Point = { x: number; y: number };
const regionById = (id: string) => REGIONS.find((region) => region.id === id)!;

function LandmarkArt({ type }: { type: string }) {
  if (type === "hut") return <g className="hut-art"><path d="M-45 16 0-22 45 16v36h-90Z" fill="#80522d" stroke="#493b2c" strokeWidth="5"/><path d="m-51 16 51-44 51 44-8 7L0-13-43 23Z" fill="#a65f35" stroke="#493b2c" strokeWidth="5"/><path d="M-10 25h20v27h-20z" fill="#493b2c"/><rect x="-34" y="25" width="13" height="13" fill="#b5d8ce" stroke="#493b2c" strokeWidth="3"/><rect x="23" y="25" width="13" height="13" fill="#b5d8ce" stroke="#493b2c" strokeWidth="3"/><path d="M28-13v-20h14v33" fill="#765039" stroke="#493b2c" strokeWidth="4"/></g>;
  if (type === "cave") return <g><path d="M-68 40q0-78 68-90 68 12 68 90z" fill="#6b7084" stroke="#343844" strokeWidth="8"/><path d="M-40 40q2-47 40-52 38 5 40 52z" fill="#19222d"/><path d="m-53-5 15-35 12 39m61 2 10-33 13 31" fill="#88d1db" stroke="#38515e" strokeWidth="4"/><path d="m-19-5 8-25 9 27m28 3 8-24 7 26" fill="#a895eb"/></g>;
  if (type === "foundry") return <g><path d="M-58 45v-66l35 22v-22l37 22v-39h25v83z" fill="#9a7450" stroke="#514333" strokeWidth="5"/><path d="M-57-21h34v-20h16v38M23-38h16v-20h15v58" fill="#807a70" stroke="#514333" strokeWidth="5"/><rect x="-35" y="14" width="16" height="17" fill="#94c5c1"/><rect x="8" y="14" width="16" height="17" fill="#94c5c1"/><path d="M-58 45h116" stroke="#514333" strokeWidth="7"/></g>;
  if (type === "windmill") return <g><path d="M-23 2h46l-7 47h-32z" fill="#bfa57a" stroke="#594b37" strokeWidth="4"/><path d="M0 4v-48m0 0-28-18m28 18 29-18M0-44l-2-30m2 30 26 18M0-44l-27 19" stroke="#6d583a" strokeWidth="7"/><circle cy="-44" r="8" fill="#d2b574"/></g>;
  return <g><path d="M-55 15h110v36h-110z" fill="#8c7052" stroke="#514536" strokeWidth="5"/><path d="M-42 15v-32h84v32M-51-17l51-30 51 30z" fill="#71918b" stroke="#514536" strokeWidth="5"/><rect x="-9" y="28" width="18" height="23" fill="#4b473a"/><path d="M-29-25v-17h10v17m37 0v-20h10v20" fill="#79614a"/></g>;
}

export default function WorldMap() {
  const router = useRouter();
  const character = useSavedCompanion();
  const progress = usePersisted(progressStore);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; x: number; y: number; moved: boolean } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Point>({ x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [position, setPosition] = useState<Point>({ x: 280, y: 345 });
  const [moving, setMoving] = useState(false);
  const [motionReduced, setMotionReduced] = useState(false);
  const [lessonStarted, setLessonStarted] = useState(false);
  const [menu, setMenu] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const timers = useRef<number[]>([]);
  const completed = progress.challengeComplete ? 1 : 0;
  const explorer = character ?? "rune";

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotionReduced(query.matches);
    sync(); query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setLessonStarted(window.localStorage.getItem("neuralarc:v1:last-lesson") === "neuron-basics"); }
      catch { setLessonStarted(false); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let firstMeasure = true;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width, height = entry.contentRect.height;
      setSize({ width, height });
      setCamera((current) => {
        const point = firstMeasure ? { x: width / 2 - 280, y: height / 2 - 345 } : current;
        firstMeasure = false;
        return { x: Math.min(0, Math.max(width - WORLD.width, point.x)), y: Math.min(0, Math.max(height - WORLD.height, point.y)) };
      });
    });
    observer.observe(el); return () => observer.disconnect();
  }, []);
  const clampCamera = useCallback((point: Point): Point => ({
    x: Math.min(0, Math.max(size.width - WORLD.width, point.x)),
    y: Math.min(0, Math.max(size.height - WORLD.height, point.y)),
  }), [size]);
  const focus = (regionId: string) => {
    const target = regionById(regionId);
    const next = clampCamera({ x: size.width / 2 - target.x, y: size.height / 2 - target.y });
    if (!drag.current?.moved) setCamera(next);
    setSelected(regionId);
    if (regionId === "grove") return;
    const route = [WAYPOINTS.grove[0], ...WAYPOINTS.caves, ...WAYPOINTS.foundry, ...WAYPOINTS.training, ...WAYPOINTS.frontier];
    const targetIndex = route.findIndex((point, index) => index === route.length - 1 || (point.x === WAYPOINTS[regionId].at(-1)?.x && point.y === WAYPOINTS[regionId].at(-1)?.y));
    const nearestIndex = route.reduce((best, point, index) => {
      const distance = (point.x - position.x) ** 2 + (point.y - position.y) ** 2;
      const bestDistance = (route[best].x - position.x) ** 2 + (route[best].y - position.y) ** 2;
      return distance < bestDistance ? index : best;
    }, 0);
    const direction = targetIndex >= nearestIndex ? 1 : -1;
    const points: Point[] = [];
    for (let index = nearestIndex + direction; direction > 0 ? index <= targetIndex : index >= targetIndex; index += direction) points.push(route[index]);
    timers.current.forEach(window.clearTimeout); timers.current = [];
    if (!points.length) { setMoving(false); return; }
    if (motionReduced) { setPosition(points.at(-1)!); setMoving(false); return; }
    setMoving(true);
    points.forEach((point, index) => timers.current.push(window.setTimeout(() => {
      setPosition(point);
      if (index === points.length - 1) setMoving(false);
    }, (index + 1) * 430)));
  };
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button,a")) return;
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.current.x, dy = event.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
    drag.current.x = event.clientX; drag.current.y = event.clientY;
    if (drag.current.moved) setCamera((current) => clampCamera({ x: current.x + dx, y: current.y + dy }));
  };
  const stopDrag = () => { if (drag.current) { window.setTimeout(() => { drag.current = null; }, 0); } };
  const openLesson = () => { try { window.localStorage.setItem("neuralarc:v1:last-lesson", "neuron-basics"); } catch { /* Continue even when storage is unavailable. */ } router.push("/learn/docs?lesson=neuron-basics&from=world"); };
  const resume = () => openLesson();
  const active = selected ? regionById(selected) : null;
  const status = (id: string) => id !== "grove" ? "upcoming" : completed ? "completed" : lessonStarted ? "in-progress" : "available";
  const overview = () => { setSelected(null); setCamera(clampCamera({ x: size.width / 2 - WORLD.width / 2, y: size.height / 2 - WORLD.height / 2 })); };

  return <main className="world-app">
    <header className="world-header">
      <Link href="/" className="world-brand" aria-label="NeuralArc home"><span>Neural<span>Arc</span></span></Link>
      <div className="world-title"><span>THE NEURAL FRONTIER</span><strong>Your learning journey</strong></div>
      <div className="world-progress"><span>{completed} / 1 available lesson completed</span><i><b style={{ width: `${completed * 100}%` }} /></i></div>
      <button type="button" className="world-header-button world-resume" onClick={resume}>Resume learning <span>↗</span></button>
      <button type="button" className="world-menu-toggle" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Map settings">•••</button>
      {menu && <div className="world-menu"><button onClick={overview}>Map overview</button><button onClick={() => setShowLabels(!showLabels)}>{showLabels ? "Hide" : "Show"} all labels</button><label><input type="checkbox" checked={motionReduced} onChange={(e) => setMotionReduced(e.target.checked)} /> Reduce motion</label></div>}
    </header>
    <div className="world-stage" ref={stageRef} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
      <div className="world-canvas" style={{ transform: `translate(${camera.x}px, ${camera.y}px)` }}>
        <svg className="terrain" viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} aria-hidden="true" shapeRendering="crispEdges">
          <defs><pattern id="grass" width="64" height="64" patternUnits="userSpaceOnUse"><rect width="64" height="64" fill="#719b4e"/><path d="M9 15h5v4H9zm34 34h5v4h-5zM50 8h3v3h-3zM18 50h3v3h-3z" fill="#82aa5a"/><path d="M26 25h4v4h-4zM56 58h4v3h-4z" fill="#658d49"/></pattern><pattern id="dirt" width="36" height="26" patternUnits="userSpaceOnUse"><rect width="36" height="26" fill="#b28a55"/><path d="M4 7h7v3H4zm19 12h9v3h-9z" fill="#c59b62"/><path d="M15 3h3v3h-3zM3 21h4v2H3z" fill="#9d7548"/></pattern><pattern id="rock" width="52" height="46" patternUnits="userSpaceOnUse"><rect width="52" height="46" fill="#72787c"/><path d="m0 9 14-8 12 5-5 10-15 3zm30 23 13-9 9 7-4 12H33z" fill="#81878a"/><path d="m13 35 8-7 8 5-6 8h-9z" fill="#666c70"/></pattern></defs>
          <rect width="1800" height="1120" fill="url(#grass)"/>
          <path d="M590 380q80-170 215-170t230 105q160 80 270 150t198-20q90-100 222-115v355q-140-25-230 66t-220 18q-120-40-190-115t-245-38q-170 45-280-35z" fill="url(#rock)" opacity=".72"/>
          <path d="M-20 260q170 10 280 60t180 70q130 50 210 130t220 13q130-100 220-125t185 90q130 140 195 135t150-135q80-115 205-110" fill="none" stroke="#705339" strokeWidth="74" strokeLinecap="square"/><path d="M-20 260q170 10 280 60t180 70q130 50 210 130t220 13q130-100 220-125t185 90q130 140 195 135t150-135q80-115 205-110" fill="none" stroke="url(#dirt)" strokeWidth="58" strokeLinecap="square"/>
          <path d="M690 472q-22 42-4 78t64 30" fill="none" stroke="#5b5143" strokeWidth="20"/><path d="M688 468q-22 42-4 78t64 30" fill="none" stroke="#9b7950" strokeWidth="14"/>
          <path d="M30 760q140-90 240-36t125 110q-46 72-142 86t-215-33z" fill="#397f8b" stroke="#876a43" strokeWidth="15"/><path d="M40 786q140-65 225-20t105 74" fill="none" stroke="#83c4c1" strokeWidth="7" strokeDasharray="13 26" className="world-water"/>
          <path d="M110 710 150 748M160 694l-48 64M212 713l-54 52" stroke="#765535" strokeWidth="12"/><path d="M330 415h90M344 432h92" stroke="#746247" strokeWidth="9"/><path d="M340 412v28m22-28v28m22-28v28m22-28v28" stroke="#d2b985" strokeWidth="5"/>
          {Array.from({length: 22}, (_, i) => { const x = (i * 173 + 62) % 1760, y = (i * 97 + 84) % 1000; return <g key={i} transform={`translate(${x} ${y})`} className={i % 3 === 0 ? "tree tree-sway" : "tree"}><rect x="-5" y="13" width="10" height="20" fill="#63452d"/><rect x="-21" y="-3" width="42" height="25" fill={i%2 ? "#416d3e" : "#4f7941"}/><rect x="-14" y="-13" width="28" height="20" fill="#60904a"/><rect x="-4" y="-18" width="8" height="8" fill="#709c50"/></g>; })}
          {[{x:515,y:280},{x:846,y:600},{x:1120,y:210},{x:1400,y:790},{x:100,y:500}].map((p,i)=><g key={i} transform={`translate(${p.x} ${p.y})`}><path d="m-26 12 14-22 28 4 17 18-10 18h-39z" fill="#777d79"/><path d="m-8 1 8-11 11 4-3 9z" fill="#999e99"/></g>)}
          {[[142,625],[183,638],[222,630],[278,483],[455,454],[870,584],[1100,675],[1480,733]].map(([x,y],i)=><g key={i} transform={`translate(${x} ${y})`}><rect y="-11" width="4" height="12" fill="#38653b"/><rect x="-5" y="-15" width="6" height="5" fill={i%2?"#d5c972":"#c987a4"}/><rect x="4" y="-16" width="5" height="5" fill="#e0cb70"/></g>)}
          <g transform="translate(482 338)"><rect x="-3" y="-24" width="6" height="43" fill="#65482d"/><path d="M0-24h74v25H0z" fill="#b68b56" stroke="#65482d" strokeWidth="5"/><text x="8" y="-7" fill="#342e26" fontSize="12" fontWeight="bold">GROVE →</text></g>
          <g transform="translate(294 480)"><path d="M0 4q-24-17 0-38 24 21 0 38" fill="#e7a950"/><path d="M0 3q-10-10 0-22 10 12 0 22" fill="#f0d477"/><path d="M-17 9h34" stroke="#583c2b" strokeWidth="6"/></g>
        </svg>
        {REGIONS.map(region => <button type="button" key={region.id} className={`world-landmark ${selected === region.id ? "is-selected" : ""} state-${status(region.id)}`} style={{ left: region.x, top: region.y }} aria-label={`${region.name}, ${status(region.id) === "upcoming" ? "coming soon" : status(region.id)}`} aria-pressed={selected === region.id} onClick={() => selected === region.id ? setSelected(null) : focus(region.id)} onFocus={() => {}}>
          <span className="landmark-ring"/><span className={`landmark-art ${region.type}`}><LandmarkArt type={region.type}/></span><span className={`landmark-name ${showLabels || selected === region.id ? "is-visible" : ""}`}>{region.name}</span><span className="landmark-state">{status(region.id) === "completed" ? "✓ Complete" : status(region.id) === "upcoming" ? "Coming soon" : status(region.id) === "in-progress" ? "In progress" : "Available"}</span>
        </button>)}
        <div className={`world-player ${moving ? "is-walking" : ""}`} style={{ left: position.x, top: position.y }} aria-label={character ? `${character} exploring the world` : "Explorer at the starting point"}>
          <PixelSprite character={explorer} state={moving ? "walk" : "idle"} size={48} />
          <span className="player-shadow"/>
        </div>
        <div className="world-region-label grove-label">THE NEURON GROVE</div><div className="world-region-label caves-label">ACTIVATION CAVES</div><div className="world-region-label foundry-label">NETWORK FOUNDRY</div><div className="world-region-label training-label">TRAINING GROUNDS</div><div className="world-region-label frontier-label">AGENT FRONTIER</div>
      </div>
      <div className="map-controls"><button onClick={overview} aria-label="Show whole map">⌖</button><button onClick={() => focus("grove")} aria-label="Return to starting area">⌂</button></div>
      {!active && <div className="map-hint"><span>✥</span> Choose a landmark to explore <small>Drag to travel</small></div>}
      {active && <aside className="destination-panel" aria-label={`${active.name} details`}>
        <button className="panel-close" onClick={() => setSelected(null)} aria-label="Close destination details">×</button><div className="panel-eyebrow">REGION {active.number} <span>•</span> {active.id === "grove" ? "NEURON GROVE" : "THE NEURAL FRONTIER"}</div><h1>{active.name}</h1><p>{active.description}</p><div className="panel-topics-label">{active.lessonIds.length ? "YOU'LL EXPLORE" : "ON THE TRAIL"}</div><div className="panel-topics">{active.topics.map(topic=><span key={topic}>{topic}</span>)}</div>
        <div className="panel-status"><i className={`status-mark ${status(active.id)}`}>{status(active.id) === "completed" ? "✓" : status(active.id) === "upcoming" ? "…" : "◆"}</i><span>{status(active.id) === "completed" ? "Lesson complete" : status(active.id) === "upcoming" ? "These lessons are still being built." : status(active.id) === "in-progress" ? "Your lesson is in progress" : "Ready when you are"}</span></div>
        {active.id === "grove" ? <button className="panel-action" onClick={openLesson}>{completed ? "Review lesson" : lessonStarted ? "Continue learning" : "Start learning"}<span>→</span></button> : <button className="panel-action is-disabled" disabled>Coming soon<span>⌁</span></button>}
      </aside>}
      <nav className="accessible-destinations" aria-label="Learning destinations">{REGIONS.map(region=><button key={region.id} onClick={()=>focus(region.id)}>{region.name} — {status(region.id)}</button>)}</nav>
    </div>
    <div className="world-footer"><span>THE NEURAL FRONTIER <i>•</i> TRAVELING WITH {explorer.toUpperCase()}</span><button onClick={resume}>Resume your lesson <span>↗</span></button></div>
  </main>;
}

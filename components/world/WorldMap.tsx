"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import PixelSprite from "@/components/companion/PixelSprite";
import { useSavedCompanion } from "@/components/companion/companionStore";
import { progressStore, usePersisted } from "@/lib/storage/stores";
import { REGIONS, ROUTE_TILES, TILE, WORLD } from "@/lib/world/mapData";
import type { Region, RegionId } from "@/lib/world/mapData";
import { loadWorldAssets, renderWorld } from "@/lib/world/canvasRenderer";
import { WAYPOINTS } from "@/lib/world/mapData";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { AnimationState, CompanionId } from "@/components/companion/companionTypes";

type Point={x:number;y:number};
const START=WAYPOINTS.grove[0];
const positions:Record<RegionId,Point>={grove:START,caves:WAYPOINTS.caves.at(-1)!,foundry:WAYPOINTS.foundry.at(-1)!,training:WAYPOINTS.training.at(-1)!,frontier:WAYPOINTS.frontier.at(-1)!};
const label=(region:Region,state:string)=>`${region.name}, ${state}`;
function regionAt(worldX:number,worldY:number):Region|undefined{return REGIONS.find((r)=>Math.hypot(worldX-(r.x+TILE/2),worldY-(r.y+TILE/2))<52);}

function WorldCanvas({selected,completed,reducedMotion}:{selected:RegionId|null;completed:boolean;reducedMotion:boolean}){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const assetsRef=useRef<Record<string,HTMLImageElement>|null>(null);
  const [ready,setReady]=useState(false);
  const [frame,setFrame]=useState(0);
  useEffect(()=>{let mounted=true;loadWorldAssets().then((assets)=>{if(mounted){assetsRef.current=assets;setReady(true);}});return()=>{mounted=false;};},[]);
  useEffect(()=>{
    if(reducedMotion)return;
    const timer=window.setInterval(()=>{if(!document.hidden)setFrame((n)=>(n+1)%4);},520);
    return()=>window.clearInterval(timer);
  },[reducedMotion]);
  useEffect(()=>{
    const canvas=canvasRef.current,assets=assetsRef.current;
    if(!canvas||!assets)return;
    const dpr=Math.max(1,Math.min(3,window.devicePixelRatio||1));
    canvas.width=Math.round(WORLD.width*dpr);canvas.height=Math.round(WORLD.height*dpr);
    const ctx=canvas.getContext("2d");if(ctx)renderWorld(ctx,assets,dpr,{selected,completed,frame});
  },[ready,selected,completed,frame]);
  return <canvas ref={canvasRef} className="world-tile-canvas" width={WORLD.width} height={WORLD.height} role="img" aria-label="A top-down pixel-art landscape of grassy woodland, a winding river, two bridges, mountains, and five learning landmarks." />;
}

export default function WorldMap(){
  const router=useRouter();
  const companion=useSavedCompanion();
  const progress=usePersisted(progressStore);
  const explorer:CompanionId=companion??"rune";
  const stageRef=useRef<HTMLDivElement>(null);
  const drag=useRef<{pointer:number;x:number;y:number;startX:number;startY:number;moved:boolean}|null>(null);
  const movementTimers=useRef<number[]>([]);
  const [viewport,setViewport]=useState({width:0,height:0});
  const [camera,setCamera]=useState<Point>({x:0,y:0});
  const [position,setPosition]=useState<Point>(START);
  const [moving,setMoving]=useState(false);
  const [arriving,setArriving]=useState(false);
  const [selected,setSelected]=useState<RegionId|null>(null);
  const [reducedMotion,setReducedMotion]=useState(false);
  const [lessonStarted,setLessonStarted]=useState(false);
  const [destinationsOpen,setDestinationsOpen]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [manualReduced,setManualReduced]=useState(false);
  const [isDragging,setIsDragging]=useState(false);
  const [worldReady,setWorldReady]=useState(false);
  const completed=progress.challengeComplete;

  useEffect(()=>{
    const query=window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync=()=>setReducedMotion(query.matches||manualReduced);sync();query.addEventListener("change",sync);
    return()=>query.removeEventListener("change",sync);
  },[manualReduced]);
  useEffect(()=>{
    let active=true;
    const timer=window.setTimeout(()=>{try{if(active)setLessonStarted(window.localStorage.getItem("neuralarc:v1:last-lesson")==="neuron-basics");}catch{/* unavailable storage */}},0);
    return()=>{active=false;window.clearTimeout(timer);};
  },[]);
  const clamp=useCallback((p:Point):Point=>({x:Math.min(0,Math.max(viewport.width-WORLD.width,p.x)),y:Math.min(0,Math.max(viewport.height-WORLD.height,p.y))}),[viewport]);
  useEffect(()=>{
    const el=stageRef.current;if(!el)return;
    let initial=true;
    const observer=new ResizeObserver(([entry])=>{
      const width=entry.contentRect.width,height=entry.contentRect.height;
      setViewport({width,height});
      const first=initial;
      let restored:Point|null=null;
      if(first){
        initial=false;
        try{
          const saved=JSON.parse(window.localStorage.getItem("neuralarc:v1:world-camera")||"null") as Point|null;
          restored=saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)?saved:{x:width/2-START.x,y:height/2-START.y};
          const person=JSON.parse(window.localStorage.getItem("neuralarc:v1:world-player")||"null") as Point|null;
          if(person&&Number.isFinite(person.x)&&Number.isFinite(person.y))setPosition(person);
          const last=window.localStorage.getItem("neuralarc:v1:world-destination");
          if(last&&REGIONS.some((region)=>region.id===last))setSelected(last as RegionId);
        }catch{restored={x:width/2-START.x,y:height/2-START.y};}
      }
      setCamera((current)=>{
        const p=first?restored??{x:width/2-START.x,y:height/2-START.y}:current;
        return{x:Math.min(0,Math.max(width-WORLD.width,p.x)),y:Math.min(0,Math.max(height-WORLD.height,p.y))};
      });
      if(first)setWorldReady(true);
    });
    observer.observe(el);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{if(!worldReady)return;try{window.localStorage.setItem("neuralarc:v1:world-camera",JSON.stringify(camera));}catch{/* Camera remains usable without storage. */}},[camera,worldReady]);
  useEffect(()=>{if(!worldReady)return;try{window.localStorage.setItem("neuralarc:v1:world-player",JSON.stringify(position));}catch{/* Player remains usable without storage. */}},[position,worldReady]);
  useEffect(()=>{if(!worldReady)return;try{if(selected)window.localStorage.setItem("neuralarc:v1:world-destination",selected);else window.localStorage.removeItem("neuralarc:v1:world-destination");}catch{/* Selection remains usable without storage. */}},[selected,worldReady]);
  useEffect(()=>()=>movementTimers.current.forEach(window.clearTimeout),[]);

  const moveTo=(id:RegionId)=>{
    const route=ROUTE_TILES.map(([x,y])=>({x:x*TILE+TILE/2,y:y*TILE+TILE/2}));
    const target=positions[id];
    const targetIndex=route.reduce((best,p,i)=>Math.hypot(p.x-target.x,p.y-target.y)<Math.hypot(route[best].x-target.x,route[best].y-target.y)?i:best,0);
    const nearest=route.reduce((best,p,i)=>Math.hypot(p.x-position.x,p.y-position.y)<Math.hypot(route[best].x-position.x,route[best].y-position.y)?i:best,0);
    const step=targetIndex>=nearest?1:-1,points:Point[]=[];
    for(let i=nearest+step;step>0?i<=targetIndex:i>=targetIndex;i+=step)points.push(route[i]);
    movementTimers.current.forEach(window.clearTimeout);movementTimers.current=[];
    setSelected(id);
    setArriving(false);
    setCamera(clamp({x:viewport.width/2-target.x,y:viewport.height/2-target.y}));
    if(!points.length){setMoving(false);return;}
    if(reducedMotion){setPosition(target);setMoving(false);return;}
    setMoving(true);
    points.forEach((point,index)=>movementTimers.current.push(window.setTimeout(()=>{
      setPosition(point);if(index===points.length-1){setMoving(false);setArriving(true);movementTimers.current.push(window.setTimeout(()=>setArriving(false),900));}
    },(index+1)*250)));
  };
  const status=(id:RegionId)=>id!=="grove"?"coming soon":completed?"completed":lessonStarted?"in progress":"available";
  const startPointer=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if((event.target as HTMLElement).closest("button,a,input,[role=dialog]"))return;
    drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragPointer=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const current=drag.current;if(!current||current.pointer!==event.pointerId)return;
    const dx=event.clientX-current.x,dy=event.clientY-current.y;
    if(Math.abs(event.clientX-current.startX)+Math.abs(event.clientY-current.startY)>5){current.moved=true;setIsDragging(true);}
    current.x=event.clientX;current.y=event.clientY;
    if(current.moved)setCamera((old)=>clamp({x:old.x+dx,y:old.y+dy}));
  };
  const endPointer=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const current=drag.current;if(!current||current.pointer!==event.pointerId)return;
    if(!current.moved){const bounds=event.currentTarget.getBoundingClientRect();const world=regionAt(event.clientX-bounds.left-camera.x,event.clientY-bounds.top-camera.y);if(world)moveTo(world.id);}
    drag.current=null;setIsDragging(false);
  };
  const focus=(id:RegionId)=>{moveTo(id);setDestinationsOpen(false);};
  const recenter=()=>moveTo("grove");
  const overview=()=>{setSelected(null);setCamera(clamp({x:viewport.width/2-WORLD.width/2,y:viewport.height/2-WORLD.height/2}));};
  const startLesson=()=>{
    try{window.localStorage.setItem("neuralarc:v1:last-lesson","neuron-basics");}catch{/* navigation still works */}
    router.push("/learn/docs?lesson=neuron-basics&from=world");
  };
  const active=selected?REGIONS.find((r)=>r.id===selected)??null:null;
  const characterState:AnimationState=moving?"walk":arriving?"celebrate":"idle";

  return <main className="world-app">
    <header className="world-header">
      <Link href="/" className="world-brand" aria-label="NeuralArc home">Neural<span>Arc</span></Link>
      <span className="world-heading"><b>THE NEURAL FRONTIER</b><small>Overworld</small></span>
      <div className="world-header-character" aria-label={`Traveling with ${explorer}`}><PixelSprite character={explorer} state="idle" size={30} still/><span>{explorer}</span></div>
      <div className="world-progress" aria-label={`${completed?1:0} of 1 available lessons completed`}><span>{completed?1:0}<i>/ 1 lesson</i></span><b><span style={{width:completed?"100%":"0%"}}/></b></div>
      <button className="world-header-action" type="button" onClick={startLesson}>{completed?"Review lesson":"Resume lesson"}<span aria-hidden="true">↗</span></button>
      <button className="world-menu-button" type="button" onClick={()=>setDestinationsOpen((v)=>!v)} aria-expanded={destinationsOpen} aria-label="Choose a destination">Destinations</button>
      <button className="world-settings-button" type="button" onClick={()=>setSettingsOpen((v)=>!v)} aria-expanded={settingsOpen} aria-label="Map settings">Settings</button>
      {destinationsOpen&&<nav className="world-popover world-destinations" aria-label="Learning destinations">{REGIONS.map((region)=><button key={region.id} type="button" onClick={()=>focus(region.id)}><span>{region.number}</span><b>{region.name}</b><small>{status(region.id)}</small></button>)}</nav>}
      {settingsOpen&&<div className="world-popover world-settings"><button type="button" onClick={overview}>Show whole map</button><button type="button" onClick={recenter}>Return to Neuron Grove</button><label><input type="checkbox" checked={manualReduced} onChange={(e)=>setManualReduced(e.target.checked)}/>Reduce movement</label></div>}
    </header>
    <section className={`world-stage ${isDragging?"is-dragging":""}`} ref={stageRef} aria-label="Explore the Neural Frontier" onPointerDown={startPointer} onPointerMove={dragPointer} onPointerUp={endPointer} onPointerCancel={()=>{drag.current=null;setIsDragging(false);}}>
      <div className="world-scene" style={{transform:`translate(${camera.x}px,${camera.y}px)`}}>
        <WorldCanvas selected={selected} completed={completed} reducedMotion={reducedMotion}/>
        <div className={`world-player ${moving?"is-walking":""}`} style={{left:position.x,top:position.y}} aria-label={`${explorer} on the trail`}>
          <PixelSprite character={explorer} state={characterState} size={40}/><span className="player-shadow"/>
        </div>
      </div>
      <div className="world-map-controls"><button type="button" onClick={overview}>World view</button><button type="button" onClick={recenter}>Starting area</button></div>
      {active&&<aside className="destination-panel" aria-label={`${active.name} details`}>
        <button className="panel-close" type="button" aria-label="Close destination details" onClick={()=>setSelected(null)}>Close</button>
        <div className="panel-eyebrow">REGION {active.number}<span> / </span>{active.id==="grove"?"AVAILABLE":"FRONTIER"}</div>
        <h1>{active.name}</h1><p>{active.description}</p>
        <div className="panel-topics-label">{active.lessonIds.length?"YOU'LL EXPLORE":"ON THE TRAIL"}</div><div className="panel-topics">{active.topics.map((topic)=><span key={topic}>{topic}</span>)}</div>
        <div className={`panel-status status-${status(active.id).replaceAll(" ","-")}`}><i aria-hidden="true">{completed&&active.id==="grove"?"✓":active.id==="grove"?"01":"…"}</i><span>{active.id==="grove"?(completed?"Lesson complete":lessonStarted?"Your lesson is in progress":"Ready when you are"):"These lessons are still being built."}</span></div>
        {active.id==="grove"?<button className="panel-action" type="button" onClick={startLesson}>{completed?"Review lesson":lessonStarted?"Continue learning":"Start learning"}<span aria-hidden="true">→</span></button>:<button className="panel-action is-upcoming" type="button" disabled>Coming soon</button>}
      </aside>}
      <nav className="world-sr-destinations" aria-label="All learning destinations">{REGIONS.map((region)=><button key={region.id} type="button" onFocus={()=>moveTo(region.id)} onClick={()=>focus(region.id)}>{label(region,status(region.id))}</button>)}</nav>
      <p className="world-canvas-description" aria-live="polite">{active?`${active.name}. ${status(active.id)}. ${active.description}`:"Use the destination menu or drag the landscape to explore."}</p>
    </section>
  </main>;
}

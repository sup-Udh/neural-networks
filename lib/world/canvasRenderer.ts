import { REGIONS, TILE, WORLD } from "./mapData";
import { BRIDGES, getTileData, WORLD_PROPS } from "./worldLayout";

type Assets = Record<string, HTMLImageElement>;
export const WORLD_ASSETS = [
  ...Array.from({length:6},(_,i)=>`terrain/grass-${i}`), "terrain/stone", ...Array.from({length:16},(_,i)=>`terrain/path-${i}`),
  ...Array.from({length:4},(_,i)=>`terrain/water-${i}`), "terrain/shore-n","terrain/shore-e","terrain/shore-s","terrain/shore-w",
  "vegetation/broadleaf-1","vegetation/broadleaf-2","vegetation/broadleaf-3","vegetation/round-tree","vegetation/pine","vegetation/bush","vegetation/flower-patch","vegetation/fallen-log",
  "props/rock-small","props/rock-pair","props/boulder","props/signpost","props/campfire","props/crystal",
  "landmarks/mountain-ridge","landmarks/activation-cave",
  "structures/field-station","structures/network-foundry","structures/ruined-watchtower","structures/bridge-horizontal","structures/bridge-vertical",
];

export async function loadWorldAssets(): Promise<Assets> {
  const entries=await Promise.all(WORLD_ASSETS.map(async(name)=>{
    const image=new Image(); image.src=`/assets/world/${name}.png`;
    try { await image.decode(); return [name,image] as const; } catch { return [name,image] as const; }
  }));
  return Object.fromEntries(entries);
}

function drawImage(ctx:CanvasRenderingContext2D,assets:Assets,name:string,x:number,y:number,w:number,h:number){
  const image=assets[name]; if(image?.complete&&image.naturalWidth) ctx.drawImage(image,Math.round(x),Math.round(y),w,h);
}
function drawProps(ctx:CanvasRenderingContext2D,assets:Assets,props:readonly (typeof WORLD_PROPS)[number][]= WORLD_PROPS){
  for(const prop of props){
    const w=prop.width??32,h=prop.height??32;
    if(prop.order===3){
      const shadowY=prop.y+h-8;
      ctx.fillStyle="#364b3470";ctx.fillRect(prop.x+8,shadowY,w-13,4);ctx.fillRect(prop.x+13,shadowY-2,w-23,2);
    }
    drawImage(ctx,assets,prop.asset,prop.x,prop.y,w,h);
  }
}

export interface WorldRenderState { selected: string|null; completed: boolean; frame: number; }
const tileData=getTileData();
export function renderWorld(ctx:CanvasRenderingContext2D,assets:Assets,dpr:number,state:WorldRenderState){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,WORLD.width,WORLD.height);
  const cols=WORLD.width/TILE;
  for(let i=0;i<tileData.grounds.length;i++){
    const x=i%cols,y=Math.floor(i/cols),g=tileData.grounds[i];
    drawImage(ctx,assets,`terrain/${g===`stone`?`stone`:`grass-${g}`}`,x*TILE,y*TILE,TILE,TILE);
  }
  // Mountain ridges sit behind the pass, water and roads.
  drawProps(ctx,assets,WORLD_PROPS.filter((p)=>(p.order??0)<=1));
  for(const cell of tileData.waters){
    const name=cell.shore?`terrain/${cell.shore}`:`terrain/water-${(cell.variant+state.frame)%4}`;
    drawImage(ctx,assets,name,cell.x*TILE,cell.y*TILE,TILE,TILE);
  }
  for(const road of tileData.roads) drawImage(ctx,assets,`terrain/path-${road.mask}`,road.x*TILE,road.y*TILE,TILE,TILE);
  drawProps(ctx,assets,BRIDGES);
  drawProps(ctx,assets,WORLD_PROPS.filter((p)=>(p.order??0)>1));
  // Destination markers are small pixel-built sign plaques attached to their landmarks.
  for(const region of REGIONS){
    const active=region.id===state.selected,done=region.id==="grove"&&state.completed;
    const x=Math.round(region.x+TILE/2),y=Math.round(region.y+TILE/2);
    if(active){ctx.strokeStyle="#101114";ctx.lineWidth=6;ctx.strokeRect(x-26,y-30,52,52);ctx.strokeStyle="#c6f04a";ctx.lineWidth=3;ctx.strokeRect(x-23,y-27,46,46);}
    ctx.fillStyle="#59412e";ctx.fillRect(x-12,y-35,24,13);ctx.fillStyle="#bb945e";ctx.fillRect(x-10,y-34,20,9);
    ctx.fillStyle=done?"#c6f04a":region.id==="grove"?"#eef0f2":"#d9d1b7";ctx.font="bold 8px monospace";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(done?"✓":region.number,x,y-29);
  }
  // Two short highlight bands give the river a living surface without smoothing its edges.
  const shimmer=[0,1,2,3][state.frame%4];ctx.fillStyle="#a5d5c5";
  for(let i=0;i<tileData.waters.length;i+=13){const c=tileData.waters[(i+shimmer*7)%tileData.waters.length];if(!c.shore)ctx.fillRect(c.x*TILE+3+(state.frame%3),c.y*TILE+5,3,1);}
}

export function worldAssetsLoaded(assets:Assets){return WORLD_ASSETS.every((name)=>assets[name]?.complete&&assets[name]?.naturalWidth>0);}

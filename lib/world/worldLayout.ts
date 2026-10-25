import { GRID, REGIONS, RIVER_TILES, TILE, WOODLANDS, WORLD } from "./mapData";

export type GroundTile = number | "stone" | "sand";
export interface WorldProp { asset: string; x: number; y: number; width?: number; height?: number; order?: number; }

const key = (x: number, y: number) => `${x},${y}`;
const grid = Array.from({ length: GRID.rows }, (_, y) => Array.from({ length: GRID.columns }, (_, x) => (x * 7 + y * 11 + x * y * 3) % 9 < 4 ? (x + 2*y) % 6 : (x * 5 + y * 3) % 6));
const water = new Set<string>(), shore = new Set<string>(), path = new Set<string>(), pathMask = new Map<string, number>();
const stone = new Set<string>();

function rasterLine(points: readonly (readonly [number, number])[], visit: (x: number, y: number) => void) {
  for (let i=0;i<points.length-1;i++) {
    let [x0,y0]=points[i]; const [x1,y1]=points[i+1];
    const dx=Math.abs(x1-x0), sx=x0<x1?1:-1, dy=-Math.abs(y1-y0), sy=y0<y1?1:-1;
    let error=dx+dy;
    for (;;) { visit(x0,y0); if(x0===x1&&y0===y1) break; const twice=2*error; if(twice>=dy){error+=dy;x0+=sx;} if(twice<=dx){error+=dx;y0+=sy;} }
  }
}

// River follows the low ground along the west and south, then turns through a narrow gorge.
rasterLine(RIVER_TILES,(cx,cy)=>{ for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++) if(ox*ox+oy*oy<=2) water.add(key(cx+ox,cy+oy)); });
// A quiet pool in the grove and a crystal pool beside the cave.
for(let y=30;y<35;y++) for(let x=4;x<10;x++) if(((x-7)/3)**2+((y-32)/2.2)**2<1) water.add(key(x,y));
for(let y=17;y<21;y++) for(let x=34;x<39;x++) if(((x-36)/2.5)**2+((y-19)/1.8)**2<1) water.add(key(x,y));
for(const cell of water){const [x,y]=cell.split(",").map(Number);for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]])if(!water.has(key(x+dx,y+dy)))shore.add(key(x+dx,y+dy));}

// Main road and secondary paths are orthogonal, tile-authored branches.
const roadBranches = [
  [[11,21],[17,21],[17,17],[23,17],[27,17],[29,14],[32,14]],
  [[32,14],[36,14],[36,22],[42,22],[46,26],[46,31],[48,34]],
  [[48,34],[53,34],[55,30],[59,30],[59,23],[59,19]],
  [[59,19],[63,19],[66,23],[68,28],[72,32],[72,36]],
  [[11,21],[8,22],[6,25]], [[48,34],[43,36],[41,40]], [[59,30],[63,34],[64,39]], [[72,32],[76,29]],
] as const;
// Each branch is rasterized independently so mask directions meet correctly at junctions.
for(const route of roadBranches) rasterLine(route,(x,y)=>path.add(key(x,y)));
for(const cell of path){const [x,y]=cell.split(",").map(Number);let mask=0;if(path.has(key(x,y-1)))mask|=1;if(path.has(key(x+1,y)))mask|=2;if(path.has(key(x,y+1)))mask|=4;if(path.has(key(x-1,y)))mask|=8;pathMask.set(cell,mask);}

// Two crossings join opposite banks; small side spurs lead to water and woodland clearings.
export const BRIDGES: readonly WorldProp[] = [
  {asset:"bridge-horizontal",x:28*TILE+8-32,y:17*TILE-8,width:64,height:32,order:4},
  {asset:"bridge-horizontal",x:42*TILE-24,y:21*TILE-8,width:64,height:32,order:4},
];

// Rocky high ground is a set of stepped plateaus beneath individual ridge sprites.
for(let y=5;y<19;y++) for(let x=24;x<41;x++) {
  const ridge=((x-32)/9)**2+((y-11)/8)**2;
  if(ridge<1 && (x*13+y*7)%7<5) stone.add(key(x,y));
}
for(let y=8;y<17;y++) for(let x=42;x<49;x++) if(((x-45)/4)**2+((y-12)/5)**2<1) stone.add(key(x,y));

const routeClear=(x:number,y:number,r=2)=>{for(let yy=y-r;yy<=y+r;yy++)for(let xx=x-r;xx<=x+r;xx++)if(path.has(key(xx,yy)))return true;return false;};
const waterNear=(x:number,y:number,r=2)=>{for(let yy=y-r;yy<=y+r;yy++)for(let xx=x-r;xx<=x+r;xx++)if(water.has(key(xx,yy)))return true;return false;};
const props:WorldProp[]=[];
const add=(asset:string,x:number,y:number,width?:number,height?:number,order=3)=>props.push({asset,x:x*TILE,y:y*TILE,width,height,order});

// Carefully spaced tree clusters form the woodland edges and open the learning clearings.
for(const cluster of WOODLANDS){
  for(let y=cluster.y-cluster.ry;y<=cluster.y+cluster.ry;y++)for(let x=cluster.x-cluster.rx;x<=cluster.x+cluster.rx;x++){
    const d=((x-cluster.x)/cluster.rx)**2+((y-cluster.y)/cluster.ry)**2;
    const variation=(x*17+y*29+x*y*5)%11;
    if(d<1 && variation<7 && !routeClear(x,y,3) && !waterNear(x,y,2) && !stone.has(key(x,y))){
      if((x*3+y*5)%5!==0){
        const asset=["broadleaf-1","broadleaf-2","broadleaf-3","round-tree","pine"][(x*7+y*3)%5];
        const [width,height]=asset==="round-tree"?[32,40]:asset==="pine"?[32,48]:[40,48];
        props.push({asset,x:x*TILE-Math.floor(width/2),y:y*TILE-height+8,width,height,order:3});
      }
    }
  }
}

// Mountain ridge crests, separate boulders and a cave mouth make the highlands legible.
props.push({asset:"mountain-ridge",x:24*TILE-8,y:4*TILE-26,width:128,height:112,order:1});
props.push({asset:"mountain-ridge",x:34*TILE,y:7*TILE-22,width:128,height:112,order:1});
props.push({asset:"mountain-ridge",x:42*TILE+4,y:8*TILE-18,width:128,height:112,order:1});
add("activation-cave",29,11,64,48,2);
add("crystal",27,15,24,32,2); add("crystal",36,16,24,32,2); add("crystal",39,12,24,32,2);
add("rock-small",23,19,20,16,2); add("rock-pair",39,20,30,19,2); add("boulder",42,18,36,28,2);

// Five destination buildings, cabins and watch points.
props.push({asset:"field-station",x:9*TILE,y:18*TILE,width:48,height:48,order:2});
props.push({asset:"network-foundry",x:45*TILE,y:30*TILE,width:64,height:52,order:2});
props.push({asset:"ruined-watchtower",x:70*TILE,y:32*TILE,width:36,height:56,order:2});
// Training field and frontier settlement outpost.
add("field-station",58,15,48,48,2); add("network-foundry",68,38,64,52,2);
// Signposts, lookout stones, a camp, and a bridge approach.
add("signpost",14,19,28,36,5); add("signpost",31,13,28,36,5); add("signpost",50,33,28,36,5);
add("campfire",13,26,28,28,5); add("rock-pair",16,25,30,19,3); add("rock-small",6,29,20,16,3);
add("fallen-log",3,39,32,16,3); add("bush",5,18,24,20,3); add("flower-patch",7,25,24,20,3);
add("flower-patch",19,14,24,20,3); add("bush",19,24,24,20,3); add("rock-small",30,22,20,16,3);
add("flower-patch",43,29,24,20,3); add("bush",51,38,24,20,3); add("campfire",55,36,28,28,5);
add("signpost",61,17,28,36,5); add("rock-pair",64,25,30,19,3); add("flower-patch",66,35,24,20,3);
add("bush",73,38,24,20,3); add("rock-small",75,34,20,16,3);

// Minor, deterministic ground props are clustered around clearings and edges, never on paths.
for(let y=2;y<GRID.rows-2;y++)for(let x=2;x<GRID.columns-2;x++){
  const n=(x*19+y*37+x*y*11)%97;
  if(n<3 && !routeClear(x,y,1) && !waterNear(x,y,1) && !stone.has(key(x,y))) add(n===0?"rock-small":"flower-patch",x,y,n===0?18:20,n===0?14:16,2);
}

export const WORLD_PROPS = props.sort((a,b)=>(a.order??3)-(b.order??3)||a.y-b.y);
export const LANDMARKS = REGIONS.map((region)=>({id:region.id,x:region.x+TILE/2,y:region.y+TILE/2,type:region.type}));

export function getTileData(){
  const grounds: (number|"stone")[]=[]; const waters:{x:number;y:number;shore?:string;variant:number}[]=[];const roads:{x:number;y:number;mask:number}[]=[];
  for(let y=0;y<GRID.rows;y++)for(let x=0;x<GRID.columns;x++){
    const k=key(x,y); grounds.push(stone.has(k)?"stone":grid[y][x]);
    if(water.has(k)) waters.push({x,y,variant:(x*3+y*5)%4}); else if(shore.has(k)){
      const s=water.has(key(x,y+1))?"shore-s":water.has(key(x,y-1))?"shore-n":water.has(key(x+1,y))?"shore-e":"shore-w";
      waters.push({x,y,shore:s,variant:0});
    }
    if(path.has(k)) roads.push({x,y,mask:pathMask.get(k)??0});
  }
  return {grounds,waters,roads,width:WORLD.width,height:WORLD.height};
}

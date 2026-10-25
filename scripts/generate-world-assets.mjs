import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = join(process.cwd(), "public/assets/world");
const palette = {
  ink: "#304232", deep: "#325c39", green: "#527e43", leaf: "#6b9a4b", light: "#8eae58", lime: "#b9c66a",
  soil: "#78563a", soil2: "#957047", sand: "#c29a60", sandLight: "#d6b579", sandShade: "#a9814f",
  water: "#367c91", waterDeep: "#285d78", waterLight: "#62aabe", waterGlint: "#a5d5c5",
  stone: "#666b67", stoneLight: "#92958b", stoneDark: "#424a49", snow: "#c3c4b3",
  wood: "#784d32", woodLight: "#a86d42", woodHi: "#c18b56", roof: "#a4513b", roofHi: "#c16a49",
  violet: "#8d79bd", crystal: "#71c2c7", flower: "#f1d176", rose: "#d9888a", white: "#e4dfbb",
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function image(w, h) {
  const pixels = Buffer.alloc(w * h * 4);
  const p = (x, y, color) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    const c = color ? (palette[color] ?? color) : null;
    if (c) { pixels[i] = rgb(c)[0]; pixels[i + 1] = rgb(c)[1]; pixels[i + 2] = rgb(c)[2]; pixels[i + 3] = 255; }
    else pixels.fill(0, i, i + 4);
  };
  const r = (x, y, ww, hh, color) => { for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + ww; xx++) p(xx, yy, color); };
  const poly = (points, color) => {
    const minY = Math.min(...points.map((v) => v[1])), maxY = Math.max(...points.map((v) => v[1]));
    for (let y = minY; y <= maxY; y++) {
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const [x1,y1] = points[i], [x2,y2] = points[(i+1)%points.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(Math.floor(x1 + (y-y1)*(x2-x1)/(y2-y1)));
      }
      xs.sort((a,b)=>a-b); for (let i=0;i+1<xs.length;i+=2) for(let x=xs[i];x<=xs[i+1];x++) p(x,y,color);
    }
  };
  const save = async (path) => { await mkdir(dirname(path), { recursive:true }); await sharp(pixels,{raw:{width:w,height:h,channels:4}}).png().toFile(path); };
  return { w,h,p,r,poly,save };
}
const pathOut = (category, name) => join(root, category, `${name}.png`);

// Terrain tiles are 16x16; all accents are deliberately grouped rather than noise-filled.
for (let variant=0;variant<6;variant++) {
  const im=image(16,16), base=["green","green","green","leaf","green","deep"][variant]; im.r(0,0,16,16,base);
  const marks=[[[2,3,"leaf"],[10,11,"deep"],[6,7,"light"]],[[4,12,"light"],[12,3,"deep"],[1,8,"leaf"]],[[8,3,"light"],[3,10,"deep"],[13,8,"leaf"]],[[1,2,"deep"],[7,12,"leaf"],[12,5,"light"]],[[5,5,"leaf"],[10,13,"deep"],[2,12,"light"]],[[3,7,"deep"],[11,4,"leaf"],[8,13,"light"]]][variant];
  marks.forEach(([x,y,c])=>im.r(x,y,2,1,c));
  if(variant===3){im.r(3,5,1,1,"flower");im.r(4,5,1,1,"white");}
  if(variant===4){im.r(10,5,2,1,"stoneLight");im.r(11,4,1,1,"stone");}
  if(variant===5){im.r(5,2,2,2,"deep");im.r(11,11,2,2,"deep");}
  await im.save(pathOut("terrain",`grass-${variant}`));
}
{
  const im=image(16,16);im.r(0,0,16,16,"stoneDark");im.r(2,2,8,5,"stone");im.r(10,7,5,6,"stone");im.r(1,11,6,3,"stone");im.r(4,3,4,2,"stoneLight");im.r(11,8,3,2,"stoneLight");im.r(5,12,2,1,"stoneDark");await im.save(pathOut("terrain","stone"));
}

// Four-bit N/E/S/W path masks create authored straight, corner, branch and junction tiles.
for(let mask=0;mask<16;mask++){
  const im=image(16,16); im.r(0,0,16,16,"green"); im.r(2,2,2,1,"leaf"); im.r(12,13,2,1,"deep");
  const q=4, x0=3,y0=3,x1=13,y1=13;
  im.r(x0,y0,10,10,"sand");
  if(mask&1) im.r(3,0,10,8,"sand"); if(mask&2) im.r(8,3,8,10,"sand");
  if(mask&4) im.r(3,8,10,8,"sand"); if(mask&8) im.r(0,3,8,10,"sand");
  im.r(6,5,2,2,"sandLight"); im.r(10,10,2,1,"sandShade"); im.r(4,11,2,1,"sandLight");
  if(mask===0){im.r(5,6,6,4,"sand");}
  await im.save(pathOut("terrain",`path-${mask}`));
}
for(let v=0;v<4;v++){
  const im=image(16,16); im.r(0,0,16,16,"waterDeep");
  im.r(2+(v%2)*2,3,5,1,"water"); im.r(8,8+(v%3),6,1,"waterLight"); im.r(3,12,3,1,"water");
  im.r((v*5+1)%12,1+(v*3)%13,2,1,"waterGlint");
  await im.save(pathOut("terrain",`water-${v}`));
}
for(const [name,dir] of [["shore-n",0],["shore-e",1],["shore-s",2],["shore-w",3]]){
  const im=image(16,16); im.r(0,0,16,16,"water");
  if(dir===0) im.r(0,0,16,5,"sandLight"); if(dir===1) im.r(11,0,5,16,"sandLight");
  if(dir===2) im.r(0,11,16,5,"sandLight"); if(dir===3) im.r(0,0,5,16,"sandLight");
  const dots=dir%2?[[12,2],[13,7],[12,13]]:[[2,12],[7,13],[13,12]];dots.forEach(([x,y])=>im.r(x,y,2,1,"sand"));
  await im.save(pathOut("terrain",name));
}

function tree(name, canopy, highlight, size=40){
  const im=image(size,size+8); const cx=Math.floor(size/2);
  im.r(cx-3,size-10,6,15,"wood"); im.r(cx-1,size-8,2,11,"woodLight");
  // stepped silhouette and nested foliage masses, with a one-pixel outline.
  const rows=[[cx-7,4,cx+7],[cx-13,7,cx+13],[cx-17,12,cx+17],[cx-19,18,cx+19],[cx-18,24,cx+18],[cx-14,29,cx+14],[cx-8,33,cx+8]];
  rows.forEach(([l,y,r])=>{im.r(l,y,r-l+1,1,"ink");});
  im.poly([[cx,1],[cx+13,6],[cx+19,17],[cx+17,27],[cx+10,34],[cx-10,34],[cx-17,27],[cx-19,17],[cx-13,6]],"ink");
  im.poly([[cx,3],[cx+11,7],[cx+16,17],[cx+14,26],[cx+8,31],[cx-8,31],[cx-14,26],[cx-16,17],[cx-11,7]],canopy);
  im.r(cx-9,8,8,4,highlight); im.r(cx+2,13,9,4,canopy); im.r(cx-13,19,8,4,"leaf"); im.r(cx+6,23,7,4,"deep"); im.r(cx-5,27,9,3,canopy);
  im.r(cx-7,15,3,3,canopy); im.r(cx+2,7,4,3,"light");
  return im.save(pathOut("vegetation",name));
}
await tree("broadleaf-1","green","light"); await tree("broadleaf-2","deep","leaf"); await tree("broadleaf-3","leaf","light"); await tree("round-tree","green","light",32);
const pine=image(32,48); pine.r(14,34,5,14,"wood"); pine.r(16,36,2,10,"woodLight");
pine.poly([[16,0],[24,13],[21,13],[29,24],[24,24],[31,35],[2,35],[8,24],[4,24],[12,13],[9,13]],"ink");
pine.poly([[16,3],[22,14],[18,14],[26,24],[21,24],[28,33],[5,33],[11,24],[7,24],[15,14],[12,14]],"deep");
pine.r(10,17,7,2,"green");pine.r(7,27,9,2,"green");pine.r(18,9,4,2,"leaf");await pine.save(pathOut("vegetation","pine"));
const bush=image(24,20); bush.r(3,12,18,7,"deep");bush.r(1,8,9,8,"green");bush.r(8,4,11,11,"leaf");bush.r(15,9,8,8,"green");bush.r(5,7,4,3,"light");bush.r(12,6,3,2,"light");bush.r(19,13,3,2,"deep"); await bush.save(pathOut("vegetation","bush"));
const flowers=image(24,20);flowers.r(10,5,2,13,"deep");flowers.r(3,12,2,6,"green");flowers.r(17,11,2,7,"green");flowers.r(4,5,3,3,"rose");flowers.r(3,8,3,3,"rose");flowers.r(7,7,3,3,"rose");flowers.r(15,3,3,3,"flower");flowers.r(14,6,3,3,"flower");flowers.r(18,5,3,3,"flower");flowers.r(16,5,2,2,"white");await flowers.save(pathOut("vegetation","flower-patch"));
const log=image(32,16);log.r(3,4,26,9,"wood");log.r(5,3,22,9,"woodLight");log.r(3,5,3,7,"soil");log.r(26,4,4,8,"soil");log.r(9,5,2,5,"woodHi");log.r(18,4,2,5,"wood");await log.save(pathOut("vegetation","fallen-log"));

function rock(name,w,h,base="stone") { const im=image(w,h);im.poly([[1,h-4],[3,h-10],[7,h-13],[12,h-12],[w-5,h-8],[w-2,h-4],[w-4,h-1],[3,h-1]],"ink");im.poly([[3,h-4],[5,h-9],[8,h-11],[12,h-10],[w-7,h-7],[w-4,h-3]],base);im.r(6,h-8,5,2,"stoneLight");im.r(w-9,h-5,4,2,"stoneDark");return im.save(pathOut("props",name)); }
await rock("rock-small",20,16);await rock("rock-pair",30,19);await rock("boulder",36,28,"stone");

const mountain=image(64,56);mountain.poly([[1,53],[4,39],[14,28],[20,12],[27,23],[34,8],[42,22],[49,17],[62,50]],"ink");mountain.poly([[4,51],[8,40],[16,29],[21,17],[27,28],[34,13],[40,27],[48,22],[59,50]],"stone");mountain.poly([[8,40],[16,29],[21,17],[27,28],[24,33],[20,27],[15,37]],"stoneLight");mountain.poly([[27,28],[34,13],[40,27],[37,31],[34,25],[31,34]],"snow");mountain.poly([[42,35],[48,22],[55,38],[51,35],[48,29],[45,41]],"stoneLight");mountain.r(12,43,20,3,"stoneDark");await mountain.save(pathOut("landmarks","mountain-ridge"));

const hut=image(48,48);hut.r(8,23,32,21,"wood");hut.r(10,25,28,18,"woodLight");hut.poly([[5,25],[24,7],[44,25],[40,29],[24,14],[9,29]],"ink");hut.poly([[8,24],[24,9],[41,24],[38,27],[24,15],[11,27]],"roof");hut.r(13,31,7,7,"waterLight");hut.r(14,32,2,5,"white");hut.r(29,33,8,11,"wood");hut.r(31,35,4,9,"soil");hut.r(23,29,3,6,"wood");hut.r(23,27,3,2,"stone");await hut.save(pathOut("structures","field-station"));
const foundry=image(64,52);foundry.r(7,24,49,23,"stoneDark");foundry.r(10,26,43,20,"woodLight");foundry.poly([[4,26],[4,17],[16,17],[16,8],[28,8],[28,21],[40,21],[40,13],[55,13],[60,26]],"ink");foundry.poly([[7,24],[7,19],[19,19],[19,11],[25,11],[25,24],[43,24],[43,16],[53,16],[57,24]],"stone");foundry.r(14,30,9,8,"waterLight");foundry.r(15,31,3,6,"white");foundry.r(35,31,10,5,"wood");foundry.r(38,36,2,8,"wood");foundry.r(49,29,4,6,"roof");await foundry.save(pathOut("structures","network-foundry"));
const tower=image(36,56);tower.poly([[6,55],[7,15],[3,15],[18,3],[33,15],[29,15],[30,55]],"ink");tower.poly([[9,53],[10,18],[7,17],[18,6],[29,17],[26,18],[27,53]],"stone");tower.r(13,22,10,3,"stoneLight");tower.r(15,30,7,9,"stoneDark");tower.r(16,31,4,6,"waterDeep");tower.r(13,46,10,7,"stoneDark");await tower.save(pathOut("structures","ruined-watchtower"));
const cave=image(64,48);cave.poly([[3,45],[5,22],[15,11],[25,6],[39,6],[52,13],[60,26],[61,45]],"stoneDark");cave.poly([[8,43],[9,23],[17,14],[26,10],[38,10],[50,16],[56,28],[57,43]],"stone");cave.poly([[20,44],[20,32],[23,25],[28,20],[36,20],[42,25],[45,33],[45,44]],"ink");cave.r(15,18,9,4,"stoneLight");cave.r(43,14,7,3,"stoneLight");cave.r(12,34,5,6,"crystal");cave.r(49,30,4,9,"violet");cave.r(52,28,4,3,"crystal");await cave.save(pathOut("landmarks","activation-cave"));

const bridge=image(64,32);bridge.r(4,2,56,28,"ink");bridge.r(7,3,50,23,"wood");bridge.r(8,5,48,17,"woodLight");for(let x=10;x<57;x+=8){bridge.r(x,5,2,18,"wood");bridge.r(x,4,2,2,"woodHi");}bridge.r(5,1,4,30,"wood");bridge.r(55,1,4,30,"wood");bridge.r(2,2,8,3,"woodHi");bridge.r(54,2,8,3,"woodHi");await bridge.save(pathOut("structures","bridge-horizontal"));
const bridgeV=image(32,64);bridgeV.r(2,4,28,56,"ink");bridgeV.r(4,7,23,50,"wood");bridgeV.r(6,8,17,48,"woodLight");for(let y=10;y<57;y+=8){bridgeV.r(6,y,18,2,"wood");bridgeV.r(5,y,2,2,"woodHi");}bridgeV.r(1,5,30,4,"wood");bridgeV.r(1,55,30,4,"wood");await bridgeV.save(pathOut("structures","bridge-vertical"));
const sign=image(28,36);sign.r(12,14,4,21,"wood");sign.r(3,3,23,17,"ink");sign.r(5,5,19,13,"woodLight");sign.r(7,8,11,2,"sandLight");sign.r(7,12,8,2,"sandLight");sign.r(23,8,4,4,"woodHi");await sign.save(pathOut("props","signpost"));
const camp=image(28,28);camp.r(2,22,24,4,"soil");camp.poly([[14,3],[22,21],[7,21]],"roof");camp.poly([[14,9],[19,21],[10,21]],"flower");camp.r(13,14,3,6,"white");camp.r(6,23,4,2,"wood");camp.r(19,23,4,2,"wood");await camp.save(pathOut("props","campfire"));
const crystal=image(24,32);crystal.poly([[12,1],[19,13],[17,28],[7,30],[4,16]],"violet");crystal.poly([[12,4],[16,14],[15,25],[9,27],[7,16]],"crystal");crystal.r(9,9,3,8,"waterGlint");await crystal.save(pathOut("props","crystal"));

console.log("Generated NeuralArc local pixel-art assets in public/assets/world");

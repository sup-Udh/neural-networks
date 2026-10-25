import { Raster, rng } from "./raster.mjs";

/*
 * Hand-authored (procedural, seeded) pixel-art sprites for the overworld.
 * Each entry returns a painted raster plus the point where the object touches the ground (its depth line).
 * Palette values are sampled from the map reference so the world keeps its bright, outlined look.
 */

export const C = {
  out: "#1e2832", outSoft: "#2c3a3e",
  grass: "#8fde5e", grassLight: "#a8ec74", grassDark: "#6ccb4a", grassMark: "#4fb347",
  treeLight: "#7be3ad", treeMid: "#50d28c", treeShade: "#2da577", treeDeep: "#1a8a6e", treeOut: "#12403a",
  leafAlt: "#6bdc7a", leafAltShade: "#3fb65f",
  pineLight: "#27b59a", pine: "#1a9c84", pineDeep: "#0f6f66", pineOut: "#0e3a3a",
  trunk: "#8a5a44", trunkDark: "#5e3a2c",
  rock: "#a08278", rockLight: "#baa9a1", rockDark: "#785046", rockOut: "#2f2330",
  stoneLight: "#c9d2d7", stone: "#aabbc2", stoneShade: "#7f93a3", slate: "#55647b", slateDark: "#3a4660", stoneOut: "#252935",
  wall: "#e2d99c", wallShade: "#c9bd7e", roof: "#8d869b", roofDark: "#6c667c", roofLight: "#aaa4b8", roofOut: "#2c2634",
  white: "#f6f6f0", whiteShade: "#d9dad8", blueRoof: "#3a52b0", blueRoofLight: "#5f77d6", yellowRoof: "#f2c24f", yellowRoofShade: "#d49a30",
  door: "#715748", doorDark: "#4b3a30", window: "#3a3040",
  plank: "#b97862", plankLight: "#d0907a", plankDark: "#8a5444", plankOut: "#212a49",
  tent: "#e0903c", tentShade: "#b0642a", tentLight: "#f2b25a", tentOut: "#4a2a1a",
  hay: "#c98438", hayLight: "#e6a652", hayShade: "#9a5d28",
  fire: "#f4a02a", fireHot: "#f8dc58", fireRed: "#e04a2a",
  crystal: "#6fe0ff", crystalLight: "#c2f4ff", crystalDark: "#2f9ad0", violet: "#a58cf2", violetDark: "#6b4fc8",
  red: "#e8453c", pink: "#f58ab4", yellow: "#f8dc58", flowerWhite: "#fdfdf0",
  wood: "#a8683a", woodLight: "#c88a54", woodDark: "#704022",
  flag: "#e04a4a",
};

/** The sprites accept a seeded generator so repeated trees differ but stay stable between builds. */
const mk = (w, h) => new Raster(w, h);

function finish(r, foot, outline = C.out, opts = {}) {
  r.outline(outline, opts);
  const { raster, ox, oy } = r.trim();
  return { raster, foot: [foot[0] - ox, foot[1] - oy] };
}

/* ---------------------------------------------------------------------------------- vegetation */

function leafy(r, cx, cy, rx, ry, rand, palette) {
  const { light, mid, shade, deep } = palette;
  // Build a bumpy canopy silhouette from overlapping lobes, then shade it toward the lower right.
  const mask = mk(r.w, r.h);
  const lobes = [[0, 0, 1, 1], [-0.62, 0.22, 0.55, 0.62], [0.62, 0.22, 0.55, 0.62], [-0.1, -0.52, 0.6, 0.55], [0.32, -0.38, 0.5, 0.5]];
  for (const [ox, oy, sx, sy] of lobes) mask.ellipse(cx + ox * rx, cy + oy * ry, rx * sx + 0.5, ry * sy + 0.5, "#000");
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      if (!mask.get(x, y)) continue;
      const t = ((x - cx) / rx) * 0.55 + ((y - cy) / ry) * 0.85;
      let colour = mid;
      if (t > 0.42) colour = shade;
      if (t > 0.78) colour = deep;
      if (t < -0.55) colour = light;
      r.px(x, y, colour);
    }
  }
  // Leaf texture: short dabs, lighter on top and darker below, placed with the seeded generator.
  for (let i = 0; i < Math.round(rx * ry * 0.09); i++) {
    const x = Math.floor(cx + (rand() * 2 - 1) * rx);
    const y = Math.floor(cy + (rand() * 2 - 1) * ry);
    if (!mask.get(x, y)) continue;
    const upper = y < cy;
    const c = upper ? light : shade;
    r.px(x, y, c);
    if (mask.get(x + 1, y)) r.px(x + 1, y, c);
  }
}

export function treeRound(seed, palette = { light: C.treeLight, mid: C.treeMid, shade: C.treeShade, deep: C.treeDeep }, fruit = false) {
  const rand = rng(seed);
  const r = mk(44, 52);
  r.rect(19, 38, 5, 11, C.trunk);
  r.rect(22, 38, 2, 11, C.trunkDark);
  r.rect(17, 47, 9, 2, C.trunkDark);
  leafy(r, 22, 19, 17, 17, rand, palette);
  if (fruit) {
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(10 + rand() * 24);
      const y = Math.floor(8 + rand() * 24);
      if (r.get(x, y)) { r.px(x, y, C.red); r.px(x + 1, y, C.red); r.px(x, y + 1, "#a8281f"); }
    }
  }
  return finish(r, [22, 48], C.treeOut);
}

export function treeSmall(seed) {
  const rand = rng(seed);
  const r = mk(30, 38);
  r.rect(13, 26, 4, 9, C.trunk);
  r.rect(15, 26, 2, 9, C.trunkDark);
  leafy(r, 15, 13, 12, 12, rand, { light: C.treeLight, mid: C.treeMid, shade: C.treeShade, deep: C.treeDeep });
  return finish(r, [15, 35], C.treeOut);
}

export function pine(seed, big = false) {
  const rand = rng(seed);
  const w = big ? 30 : 24;
  const h = big ? 56 : 46;
  const r = mk(w + 4, h + 4);
  const cx = Math.floor((w + 4) / 2);
  r.rect(cx - 2, h - 8, 4, 9, C.trunk);
  r.rect(cx, h - 8, 2, 9, C.trunkDark);
  const tiers = big ? 4 : 3;
  for (let t = 0; t < tiers; t++) {
    const top = 2 + t * Math.round((h - 16) / tiers) * 0.8;
    const bottom = top + (h - 12) / tiers + 6;
    const half = Math.round(5 + t * ((w / 2 - 5) / (tiers - 0.4)));
    r.poly([[cx, top], [cx + half, bottom], [cx - half, bottom]], (x, y) => {
      const lit = x < cx - 1 || (x < cx + 1 && y < top + 4);
      if (x > cx + half * 0.45 * ((y - top) / (bottom - top))) return C.pineDeep;
      return lit ? C.pineLight : C.pine;
    });
    for (let i = 0; i < half; i++) if (rand() < 0.35) r.px(cx - half + 2 + Math.floor(rand() * half * 2 - 2), Math.round(bottom - 1 - rand() * 3), C.pineDeep);
  }
  return finish(r, [cx, h], C.pineOut);
}

/** A dense stand of tall dark conifers, like the grove at the right of the reference. */
export function cypressGrove(seed, count = 6) {
  const rand = rng(seed);
  const r = mk(76, 96);
  const trees = [];
  for (let i = 0; i < count; i++) trees.push({ x: 10 + (i % 3) * 18 + (i > 2 ? 9 : 0) + Math.floor(rand() * 4), y: 36 + Math.floor(i / 3) * 24 + Math.floor(rand() * 5) });
  trees.sort((a, b) => a.y - b.y);
  for (const t of trees) {
    r.rect(t.x - 1, t.y + 26, 4, 8, C.trunkDark);
    r.ellipse(t.x + 1, t.y + 8, 8, 24, (x, y, dx) => (dx > 0.2 ? C.pineDeep : dx < -0.35 ? C.pineLight : C.pine));
    for (let i = 0; i < 6; i++) { const x = t.x - 5 + Math.floor(rand() * 11); const y = t.y - 10 + Math.floor(rand() * 36); if (r.get(x, y)) r.px(x, y, C.pineDeep); }
  }
  return finish(r, [38, 70], C.pineOut);
}

export function moundBush(seed, w = 44, h = 24) {
  const rand = rng(seed);
  const r = mk(w + 4, h + 4);
  const cx = (w + 4) / 2;
  const base = h + 1;
  r.ellipse(cx, base, w / 2, h, (x, y, dx, dy) => {
    if (y > base) return null;
    const t = dx * 0.6 + dy * 0.9;
    if (t > 0.3) return "#6fcc4c";
    if (t < -0.45) return "#b0f07c";
    return "#8fde5e";
  });
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(cx - w / 3 + rand() * (w * 0.66));
    const y = Math.floor(base - h * 0.2 - rand() * h * 0.6);
    if (r.get(x, y)) { r.px(x, y, "#4fb347"); r.px(x + 1, y + 1, "#4fb347"); }
  }
  return finish(r, [cx, base], "#235a2e");
}

export function sapling() {
  const r = mk(16, 20);
  r.rect(7, 10, 2, 8, C.trunkDark);
  r.ellipse(8, 7, 5, 5, (x, y, dx, dy) => (dx + dy > 0.5 ? C.treeShade : dx + dy < -0.5 ? C.treeLight : C.treeMid));
  return finish(r, [8, 18], C.treeOut);
}

export function floweringBush(seed) {
  const rand = rng(seed);
  const r = mk(30, 22);
  r.ellipse(15, 13, 12, 8, (x, y, dx, dy) => (dx * 0.5 + dy > 0.35 ? C.treeShade : dy < -0.5 ? C.treeLight : C.treeMid));
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(6 + rand() * 18);
    const y = Math.floor(6 + rand() * 11);
    if (r.get(x, y)) { r.px(x, y, i % 2 ? C.pink : C.flowerWhite); r.px(x + 1, y, i % 2 ? C.pink : C.flowerWhite); }
  }
  return finish(r, [15, 20], C.treeOut);
}

export function tallGrass(seed) {
  const rand = rng(seed);
  const r = mk(18, 14);
  for (let i = 0; i < 7; i++) {
    const x = 2 + i * 2 + Math.floor(rand() * 2);
    const hgt = 5 + Math.floor(rand() * 6);
    for (let y = 0; y < hgt; y++) r.px(x + Math.floor(y * (i % 2 ? 0.2 : -0.2)), 12 - y, y > hgt - 3 ? C.treeLight : C.leafAltShade);
  }
  return finish(r, [9, 12], C.treeOut);
}

export function flowers(seed, colour) {
  const rand = rng(seed);
  const r = mk(18, 10);
  for (let i = 0; i < 4; i++) {
    const x = 2 + i * 4 + Math.floor(rand() * 2);
    const y = 2 + Math.floor(rand() * 4);
    r.px(x, y + 1, C.leafAltShade); r.px(x, y + 2, C.leafAltShade);
    r.px(x - 1, y, colour); r.px(x + 1, y, colour); r.px(x, y - 1, colour); r.px(x, y + 0, C.yellow);
  }
  return finish(r, [9, 8], "#2a6a34");
}

/* ---------------------------------------------------------------------------------- mountains */

export function mountain(seed, w, h) {
  const rand = rng(seed);
  const r = mk(w + 6, h + 6);
  const ax = Math.round(w * (0.46 + rand() * 0.1)) + 3;
  const top = 3;
  const base = h + 2;
  // Lumpy left and right silhouettes with a blunt summit, like the reference's rounded peaks.
  const left = [];
  const right = [];
  const steps = 9;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = Math.round(top + (base - top) * t);
    const edge = i === 0 || i === steps ? 0 : 1;
    const shoulder = i === 4 || i === 5 ? -Math.round(w * 0.04) : 0;
    left.push([Math.round(ax - 2 - (ax - 5) * t + edge * Math.round((rand() - 0.5) * 6) + shoulder), y]);
    right.push([Math.round(ax + 2 + (w + 1 - ax) * t + edge * Math.round((rand() - 0.5) * 4)), y]);
  }
  const poly = [...left, ...right.reverse()];
  r.poly(poly, (x, y) => {
    const ridge = ax + (y - top) * 0.12;
    const bottom = y > base - 4;
    if (x < ridge) return bottom ? C.rock : C.rockLight;
    return bottom ? C.rockDark : C.rock;
  });
  // Strata and cracks on the shaded face, plus a dark ridge line.
  for (let y = top + 3; y < base - 2; y++) r.px(Math.round(ax + (y - top) * 0.12), y, C.rockDark);
  for (let i = 0; i < Math.round(w / 4); i++) {
    const y = Math.floor(top + 6 + rand() * (h - 14));
    const x0 = Math.round(ax + (y - top) * 0.12) + 2 + Math.floor(rand() * ((w * (y - top)) / h / 2.4));
    for (let k = 0; k < 3 + Math.floor(rand() * 3); k++) if (r.get(x0 + k, y + (k >> 1))) r.px(x0 + k, y + (k >> 1), C.rockDark);
  }
  for (let i = 0; i < Math.round(w / 5); i++) {
    const y = Math.floor(top + 4 + rand() * (h - 12));
    const x = Math.round(ax - (y - top) * 0.3) - Math.floor(rand() * ((w * (y - top)) / h / 3)) - 1;
    if (r.get(x, y) === C.rockLight) { r.px(x, y, "#d4c6c0"); r.px(x - 1, y + 1, "#d4c6c0"); }
  }
  return finish(r, [ax, base], C.rockOut);
}

/* ---------------------------------------------------------------------------------- buildings */

function roofRows(r, x0, y0, x1, y1, inset, base, dark, light) {
  r.poly([[x0 + inset, y0], [x1 - inset, y0], [x1, y1], [x0, y1]], base);
  for (let y = y0 + 3, row = 0; y < y1; y += 3, row++) {
    for (let x = x0; x < x1; x++) if (r.get(x, y)) r.px(x, y, dark);
    for (let x = x0 + (row % 2 ? 3 : 0); x < x1; x += 6) for (let k = 1; k < 3; k++) if (r.get(x, y + k)) r.px(x, y + k, dark);
  }
  for (let x = x0 + inset; x < x1 - inset; x++) r.px(x, y0, light);
}

export function houseGray(seed) {
  const rand = rng(seed);
  const r = mk(64, 56);
  r.rect(6, 24, 52, 28, C.wall);
  r.rect(6, 46, 52, 6, C.wallShade);
  roofRows(r, 2, 8, 62, 28, 6, C.roof, C.roofDark, C.roofLight);
  r.rect(10, 6, 7, 8, C.wallShade);
  r.rect(10, 4, 7, 3, C.roofDark);
  for (const x of [12, 22, 42, 50]) { r.rect(x, 33, 4, 6, C.window); r.px(x, 33, "#6a5a78"); }
  r.rect(28, 34, 9, 18, C.door);
  r.rect(34, 34, 3, 18, C.doorDark);
  r.px(35, 43, C.yellow);
  if (rand() > 0.5) r.rect(42, 24, 3, 3, C.wallShade);
  return finish(r, [32, 52], C.roofOut);
}

export function houseWhite(flip = false) {
  const r = mk(76, 50);
  // Two joined gables: a yellow-roofed wing and a long blue-roofed hall.
  r.rect(4, 22, 24, 24, C.white);
  r.rect(4, 40, 24, 6, C.whiteShade);
  r.poly([[16, 4], [30, 22], [2, 22]], (x) => (x > 16 ? C.yellowRoofShade : C.yellowRoof));
  r.rect(28, 20, 44, 26, C.white);
  r.rect(28, 40, 44, 6, C.whiteShade);
  roofRows(r, 26, 10, 74, 24, 5, C.blueRoof, "#2c3e8c", C.blueRoofLight);
  r.rect(10, 28, 5, 7, C.window);
  r.rect(34, 30, 4, 6, C.window);
  r.rect(46, 30, 4, 6, C.window);
  r.rect(62, 30, 4, 6, C.window);
  r.rect(54, 30, 7, 16, C.door);
  const out = finish(r, [38, 46], C.roofOut);
  if (flip) {
    const f = new Raster(out.raster.w, out.raster.h);
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) f.data[y * f.w + x] = out.raster.get(f.w - 1 - x, y);
    return { raster: f, foot: [f.w - 1 - out.foot[0], out.foot[1]] };
  }
  return out;
}

/** The stone tower-chapel: a tall pale stone body, slate pointed roof with a cross, clock window and arched door. */
export function stoneTower() {
  const r = mk(48, 80);
  r.rect(8, 30, 32, 44, C.stoneLight);
  r.rect(8, 30, 5, 44, C.stone);
  r.rect(34, 30, 6, 44, C.stoneShade);
  for (let y = 34; y < 74; y += 4) for (let x = 8; x < 40; x++) if ((x + (Math.floor(y / 4) % 2) * 4) % 8 === 0) r.px(x, y, C.stoneShade);
  r.poly([[24, 2], [40, 30], [8, 30]], (x) => (x > 24 ? C.slateDark : C.slate));
  r.rect(22, 0, 4, 12, C.slate);
  r.rect(18, 4, 12, 3, C.slate);
  r.ellipse(24, 44, 7, 7, C.white);
  r.ellipse(24, 44, 5, 5, C.stone);
  r.rect(24, 40, 1, 5, C.slateDark);
  r.rect(24, 44, 4, 1, C.slateDark);
  r.poly([[18, 74], [18, 60], [20, 56], [28, 56], [30, 60], [30, 74]], C.door);
  r.rect(26, 58, 4, 16, C.doorDark);
  r.rect(14, 52, 3, 6, C.slateDark);
  r.rect(32, 52, 3, 6, C.slateDark);
  return finish(r, [24, 74], C.stoneOut);
}

export function castle() {
  const r = mk(92, 70);
  const tower = (x, h) => {
    const top = 70 - h - 2;
    r.rect(x, top, 18, h, C.stoneLight);
    r.rect(x, top, 3, h, C.stone);
    r.rect(x + 14, top, 4, h, C.stoneShade);
    for (let i = 0; i < 3; i++) r.rect(x + i * 7, top - 5, 4, 6, C.stoneLight);
    r.rect(x + 7, top + 8, 4, 8, C.slateDark);
    r.rect(x + 8, top - 18, 1, 13, C.slateDark);
    r.poly([[x + 9, top - 18], [x + 16, top - 15], [x + 9, top - 12]], C.flag);
  };
  r.rect(16, 32, 60, 36, C.stoneLight);
  r.rect(16, 32, 60, 4, C.stone);
  for (let i = 0; i < 7; i++) r.rect(16 + i * 9, 27, 5, 6, C.stoneLight);
  r.rect(16, 54, 60, 14, C.stone);
  tower(0, 54);
  tower(74, 54);
  tower(37, 62);
  r.poly([[36, 68], [36, 54], [40, 49], [52, 49], [56, 54], [56, 68]], C.slateDark);
  for (let y = 51; y < 68; y += 3) for (let x = 41; x < 52; x += 2) r.px(x, y, C.slate);
  return finish(r, [46, 68], C.stoneOut);
}

export function ruin() {
  const r = mk(60, 50);
  r.rect(4, 14, 22, 34, C.stoneShade);
  r.poly([[4, 14], [8, 8], [14, 10], [18, 4], [26, 12], [26, 14]], C.stone);
  r.rect(26, 24, 30, 24, C.slate);
  r.poly([[26, 24], [32, 18], [38, 22], [44, 16], [56, 24]], C.stoneShade);
  r.rect(10, 22, 6, 10, C.stoneOut);
  r.rect(36, 32, 6, 9, C.stoneOut);
  r.rect(44, 28, 4, 5, C.stoneOut);
  r.rect(4, 40, 22, 8, C.slate);
  for (let i = 0; i < 14; i++) { const x = 6 + (i * 7) % 48; const y = 16 + ((i * 11) % 28); if (r.get(x, y)) r.px(x, y, C.slateDark); }
  r.rect(22, 18, 2, 12, C.leafAltShade);
  r.rect(20, 26, 3, 4, C.treeShade);
  return finish(r, [30, 48], C.stoneOut);
}

export function ruinPillar() {
  const r = mk(16, 30);
  r.rect(3, 6, 10, 22, C.stoneLight);
  r.rect(3, 6, 3, 22, C.stone);
  r.rect(10, 6, 3, 22, C.stoneShade);
  r.poly([[3, 6], [6, 2], [9, 5], [13, 3], [13, 6]], C.stone);
  r.rect(2, 26, 12, 3, C.stoneShade);
  return finish(r, [8, 28], C.stoneOut);
}

export function bridge(len = 76) {
  const r = mk(30, len + 4);
  const w = 24;
  r.rect(3, 2, w, len, C.plank);
  for (let y = 4; y < len + 2; y += 4) {
    r.rect(3, y, w, 1, C.plankDark);
    r.rect(3, y + 1, w, 1, C.plankLight);
  }
  r.rect(3, 2, 2, len, C.plankDark);
  r.rect(w + 1, 2, 2, len, C.plankDark);
  for (let y = 2; y < len; y += 14) { r.rect(1, y, 4, 3, C.woodDark); r.rect(w, y, 4, 3, C.woodDark); }
  return finish(r, [15, len], C.plankOut);
}

/* ---------------------------------------------------------------------------------- props */

export function tent() {
  const r = mk(40, 36);
  r.poly([[20, 2], [38, 32], [2, 32]], (x, y) => {
    if (x > 20) return C.tentShade;
    return y < 14 ? C.tentLight : C.tent;
  });
  r.poly([[20, 12], [26, 32], [14, 32]], C.tentOut);
  r.line(20, 2, 20, 12, C.tentOut);
  for (let i = 0; i < 4; i++) r.px(10 + i * 2, 26 - i * 2, C.tentLight);
  return finish(r, [20, 32], C.tentOut);
}

export function hayMound(seed = 1) {
  const rand = rng(seed);
  const r = mk(30, 28);
  r.ellipse(15, 24, 12, 20, (x, y, dx, dy) => (y > 24 ? null : dx * 0.5 + dy > 0.4 ? C.hayShade : dx * 0.4 + dy < -0.6 ? C.hayLight : C.hay));
  for (let i = 0; i < 6; i++) { const x = 8 + Math.floor(rand() * 14); const y = 8 + Math.floor(rand() * 14); if (r.get(x, y)) r.px(x, y, C.hayShade); }
  return finish(r, [15, 24], "#4a2a18");
}

export function rock(seed, big = false) {
  const rand = rng(seed);
  const w = big ? 26 : 16;
  const h = big ? 18 : 11;
  const r = mk(w + 4, h + 4);
  r.ellipse((w + 4) / 2, h * 0.7 + 2, w / 2, h * 0.7, (x, y, dx, dy) => (y > h + 1 ? null : dx * 0.4 + dy > 0.35 ? C.rockDark : dy < -0.35 ? C.rockLight : C.rock));
  for (let i = 0; i < 3; i++) { const x = 4 + Math.floor(rand() * (w - 6)); const y = 3 + Math.floor(rand() * (h - 4)); if (r.get(x, y)) r.px(x, y, C.rockDark); }
  return finish(r, [(w + 4) / 2, h + 1], C.rockOut);
}

export function sign() {
  const r = mk(26, 30);
  r.rect(12, 14, 3, 14, C.woodDark);
  r.rect(2, 3, 22, 13, C.wood);
  r.rect(2, 3, 22, 3, C.woodLight);
  r.rect(2, 13, 22, 3, C.woodDark);
  r.rect(6, 8, 14, 1, C.woodDark);
  r.rect(6, 10, 9, 1, C.woodDark);
  r.px(4, 5, "#e8d8b0"); r.px(21, 5, "#e8d8b0");
  return finish(r, [13, 28], C.out);
}

export function lantern() {
  const r = mk(16, 34);
  r.rect(7, 12, 2, 20, C.woodDark);
  r.rect(4, 4, 8, 9, C.fireHot);
  r.rect(5, 6, 6, 5, C.fire);
  r.rect(3, 2, 10, 2, C.woodDark);
  r.rect(3, 13, 10, 2, C.woodDark);
  r.rect(2, 30, 12, 3, C.woodDark);
  return finish(r, [8, 32], C.out);
}

export function campfire() {
  const r = mk(24, 24);
  r.rect(3, 18, 18, 3, C.woodDark);
  r.rect(5, 15, 14, 3, C.wood);
  r.poly([[12, 2], [18, 14], [6, 14]], C.fireRed);
  r.poly([[12, 6], [16, 14], [8, 14]], C.fire);
  r.poly([[12, 9], [14, 14], [10, 14]], C.fireHot);
  return finish(r, [12, 20], C.out);
}

export function crystals() {
  const r = mk(34, 34);
  const shard = (x, base, w, h, a, b) => r.poly([[x, base - h], [x + w, base], [x - w, base]], (px) => (px > x ? b : a));
  shard(10, 30, 5, 22, C.crystal, C.crystalDark);
  shard(18, 30, 6, 28, C.crystalLight, C.crystal);
  shard(26, 30, 4, 16, C.violet, C.violetDark);
  r.px(18, 6, "#ffffff"); r.px(17, 7, "#ffffff");
  return finish(r, [18, 30], "#1c3a5e");
}

export function caveMouth() {
  const r = mk(46, 36);
  r.poly([[3, 34], [6, 14], [14, 4], [32, 4], [40, 14], [43, 34]], C.rockDark);
  r.poly([[9, 34], [11, 17], [17, 10], [29, 10], [35, 17], [37, 34]], "#1b1426");
  r.poly([[13, 34], [14, 20], [18, 15], [28, 15], [32, 20], [33, 34]], "#2a2038");
  r.rect(2, 4, 8, 4, C.rockLight);
  r.rect(36, 6, 6, 3, C.rockLight);
  r.px(21, 24, C.crystal); r.px(22, 25, C.crystalLight); r.px(28, 28, C.violet);
  return finish(r, [23, 34], C.rockOut);
}

export function stump() {
  const r = mk(18, 16);
  r.rect(3, 4, 12, 10, C.trunk);
  r.rect(11, 4, 4, 10, C.trunkDark);
  r.ellipse(9, 4, 6, 3, C.woodLight);
  r.ellipse(9, 4, 3, 1.5, C.wood);
  return finish(r, [9, 13], C.out);
}

export function mushroom() {
  const r = mk(14, 14);
  r.rect(5, 7, 4, 5, C.flowerWhite);
  r.ellipse(7, 6, 6, 4, (x, y) => (y > 7 ? null : C.red));
  r.px(5, 4, C.flowerWhite); r.px(9, 5, C.flowerWhite);
  return finish(r, [7, 12], C.out);
}

export function fenceSection() {
  const r = mk(40, 20);
  r.rect(2, 4, 4, 14, C.wood);
  r.rect(18, 4, 4, 14, C.wood);
  r.rect(34, 4, 4, 14, C.wood);
  r.rect(0, 7, 40, 3, C.woodLight);
  r.rect(0, 13, 40, 3, C.woodLight);
  r.rect(0, 9, 40, 1, C.woodDark);
  r.rect(0, 15, 40, 1, C.woodDark);
  return finish(r, [20, 18], C.out);
}

export function fieldChest() {
  const r = mk(22, 18);
  r.rect(2, 6, 18, 10, C.wood);
  r.rect(2, 3, 18, 5, C.woodLight);
  r.rect(2, 8, 18, 2, C.woodDark);
  r.rect(10, 7, 2, 4, C.yellow);
  return finish(r, [11, 16], C.out);
}

export function trainingTarget() {
  const r = mk(26, 36);
  r.rect(12, 18, 3, 16, C.woodDark);
  r.rect(6, 32, 15, 3, C.woodDark);
  r.ellipse(13, 12, 10, 10, C.flowerWhite);
  r.ellipse(13, 12, 7, 7, C.red);
  r.ellipse(13, 12, 4, 4, C.flowerWhite);
  r.ellipse(13, 12, 2, 2, C.red);
  r.rect(15, 4, 1, 8, C.woodDark);
  r.px(16, 4, C.flowerWhite);
  return finish(r, [13, 34], C.out);
}

export function rocksInWater() {
  const r = mk(34, 24);
  const parts = [[11, 15, 11, 8], [22, 17, 9, 6], [17, 11, 8, 6]];
  for (const [cx, cy, rx, ry] of parts) r.ellipse(cx, cy, rx, ry, (x, y, dx, dy) => (dx * 0.4 + dy > 0.3 ? C.rockDark : dy < -0.3 ? C.rockLight : C.rock));
  return finish(r, [17, 20], C.rockOut);
}

export function pondFlowers() {
  const r = mk(30, 12);
  const dots = [[3, 6, C.pink], [8, 3, C.flowerWhite], [13, 7, C.pink], [19, 4, C.flowerWhite], [24, 7, C.pink]];
  for (const [x, y, c] of dots) { r.px(x, y, c); r.px(x + 1, y, c); r.px(x, y + 1, C.leafAltShade); r.px(x, y + 2, C.leafAltShade); }
  return finish(r, [15, 9], "#2a6a34");
}

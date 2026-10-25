import { FRAME, NORTH_RIVER, PATHS, PATH_HALF_WIDTH, POND, WEST_RIVER_BANK, WORLD_SIZE } from "./worldMap";
import type { Point } from "./worldMap";

/*
 * Paints the ground layer once: grass with hand-placed tufts, the river and pond with pixel banks,
 * dirt trails with their own edge colour, and the dark frame. Everything is written pixel by pixel
 * (no strokes, no smoothing) so the result is real pixel art at the world's native resolution.
 */

const COLORS = {
  grass: "#8fde5e", grassDark: "#6fcb4c", tuft: "#4fb347", tuftLight: "#a8ec74",
  water: "#4da6ff", waterLight: "#79c4ff", waterDeep: "#3a8cea", ripple: "#a6dcff", bankLine: "#26385e",
  pond: "#0b8f92", pondDeep: "#067277", pondLight: "#27b3b0", pondLine: "#123f48",
  path: "#fbc979", pathEdge: "#e2a355", pathLight: "#fddc9c", pathPebble: "#d98f4a", pathLine: "#b9743a",
  frame: "#282832", frameLight: "#454558",
};

const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Small integer hash, so every "random" detail is the same on every load. */
function hash(x: number, y: number, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 1D wobble used to make banks irregular without losing pixel edges. */
const wobble = (t: number, seed: number) =>
  Math.sin(t * 0.11 + seed) * 1.6 + Math.sin(t * 0.27 + seed * 2.3) * 1.1 + Math.sin(t * 0.61 + seed * 3.7) * 0.7;

class Layer {
  readonly data: Uint8Array;
  constructor(readonly size: number) { this.data = new Uint8Array(size * size); }
  get(x: number, y: number) { return x < 0 || y < 0 || x >= this.size || y >= this.size ? 0 : this.data[y * this.size + x]; }
  set(x: number, y: number, v = 1) { if (x >= 0 && y >= 0 && x < this.size && y < this.size) this.data[y * this.size + x] = v; }
}

function interpolate(points: Point[], t: number): Point {
  const i = Math.min(points.length - 2, Math.max(0, Math.floor(t)));
  const f = t - i;
  return { x: points[i].x + (points[i + 1].x - points[i].x) * f, y: points[i].y + (points[i + 1].y - points[i].y) * f };
}

function stampDisc(layer: Layer, cx: number, cy: number, r: number) {
  const ri = Math.ceil(r);
  for (let y = -ri; y <= ri; y++) for (let x = -ri; x <= ri; x++) if (x * x + y * y <= r * r) layer.set(Math.round(cx + x), Math.round(cy + y));
}

function paintWater(): { water: Layer; pond: Layer } {
  const water = new Layer(WORLD_SIZE);
  const pond = new Layer(WORLD_SIZE);
  // West river: everything left of the east bank, with a wobbling edge.
  for (let y = 0; y < WORLD_SIZE; y++) {
    let a = WEST_RIVER_BANK[0];
    let b = WEST_RIVER_BANK[WEST_RIVER_BANK.length - 1];
    for (let i = 0; i + 1 < WEST_RIVER_BANK.length; i++) {
      if (y >= WEST_RIVER_BANK[i].y && y <= WEST_RIVER_BANK[i + 1].y) { a = WEST_RIVER_BANK[i]; b = WEST_RIVER_BANK[i + 1]; break; }
    }
    const edge = a.x + ((y - a.y) / Math.max(1, b.y - a.y)) * (b.x - a.x) + Math.round(wobble(y, 1.3));
    for (let x = 0; x < edge; x++) water.set(x, y);
  }
  // North river: sweep along its centreline with a changing half width.
  const centre = NORTH_RIVER.map((n) => n.c);
  const steps = (NORTH_RIVER.length - 1) * 90;
  for (let s = 0; s <= steps; s++) {
    const t = (s / steps) * (NORTH_RIVER.length - 1);
    const p = interpolate(centre, t);
    const i = Math.min(NORTH_RIVER.length - 2, Math.floor(t));
    const half = NORTH_RIVER[i].half + (NORTH_RIVER[i + 1].half - NORTH_RIVER[i].half) * (t - i);
    const bump = wobble(p.x, 4.1) * 0.9;
    for (let dy = -Math.ceil(half + 3); dy <= Math.ceil(half + 3); dy++) {
      const reach = half + (dy < 0 ? bump : -bump * 0.7);
      if (Math.abs(dy) <= reach) water.set(Math.round(p.x), Math.round(p.y + dy));
    }
  }
  // Pond: an ellipse with a rippled edge.
  for (let y = POND.c.y - POND.ry - 4; y <= POND.c.y + POND.ry + 4; y++) {
    for (let x = POND.c.x - POND.rx - 4; x <= POND.c.x + POND.rx + 4; x++) {
      const dx = (x - POND.c.x) / POND.rx;
      const dy = (y - POND.c.y) / POND.ry;
      const edge = 1 + wobble(Math.atan2(dy, dx) * 14, 7) * 0.035;
      if (dx * dx + dy * dy < edge * edge) pond.set(x, y);
    }
  }
  return { water, pond };
}

function paintPaths(): Layer {
  const layer = new Layer(WORLD_SIZE);
  for (const path of PATHS) {
    let travelled = 0;
    for (let i = 0; i + 1 < path.points.length; i++) {
      const a = path.points[i];
      const b = path.points[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.ceil(len * 2);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        stampDisc(layer, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, PATH_HALF_WIDTH * 0.62 + wobble(travelled + t * len, path.points.length) * 0.35 + 1.4);
      }
      travelled += len;
    }
  }
  return layer;
}

/** `phase` shifts the ripple pattern so two paints can alternate into a gentle water animation. */
export function paintTerrain(canvas: HTMLCanvasElement | OffscreenCanvas, phase = 0): void {
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return;
  const size = WORLD_SIZE;
  const image = ctx.createImageData(size, size);
  const px = image.data;
  const put = (x: number, y: number, hex: string) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const [r, g, b] = hexToRgb(hex);
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  };

  const { water, pond } = paintWater();
  const paths = paintPaths();
  const wet = (x: number, y: number) => water.get(x, y) === 1 || pond.get(x, y) === 1;

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(x, y, COLORS.grass);

  // Grass: sparse darker tufts and the odd lighter blade, never a uniform noise fill.
  const cell = 17;
  for (let cy = 0; cy < size; cy += cell) {
    for (let cx = 0; cx < size; cx += cell) {
      const roll = hash(cx, cy, 3);
      if (roll > 0.62) continue;
      const x = cx + Math.floor(hash(cx, cy, 5) * (cell - 4)) + 1;
      const y = cy + Math.floor(hash(cx, cy, 8) * (cell - 3)) + 2;
      if (wet(x, y) || wet(x + 3, y) || paths.get(x, y)) continue;
      if (roll < 0.1) {
        put(x, y, COLORS.tuftLight); put(x + 1, y, COLORS.tuftLight); put(x + 1, y - 1, COLORS.tuftLight);
      } else {
        put(x, y, COLORS.tuft); put(x + 1, y, COLORS.tuft); put(x + 2, y, COLORS.tuft); put(x + 1, y - 1, COLORS.tuft);
      }
    }
  }

  // Paths: sandy fill, orange edge, a few pebbles. Water wins where a trail meets a river (the bridges carry it across).
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!paths.get(x, y) || wet(x, y)) continue;
      const rim = !paths.get(x - 1, y) || !paths.get(x + 1, y) || !paths.get(x, y - 1) || !paths.get(x, y + 1);
      const lower = !paths.get(x, y + 1) || !paths.get(x + 1, y);
      put(x, y, rim ? (lower ? COLORS.pathLine : COLORS.pathEdge) : COLORS.path);
    }
  }
  for (let y = 2; y < size - 2; y++) {
    for (let x = 2; x < size - 2; x++) {
      if (!paths.get(x, y) || wet(x, y)) continue;
      if (!(paths.get(x - 2, y) && paths.get(x + 2, y) && paths.get(x, y - 2) && paths.get(x, y + 2))) continue;
      const r = hash(x, y, 11);
      if (r < 0.012) { put(x, y, COLORS.pathPebble); put(x + 1, y, COLORS.pathPebble); }
      else if (r < 0.03) put(x, y, COLORS.pathLight);
    }
  }

  // Water, with shore light on the water side of every bank.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!wet(x, y)) continue;
      const isPond = pond.get(x, y) === 1 && water.get(x, y) !== 1;
      const touchesLand = !wet(x - 1, y) || !wet(x + 1, y) || !wet(x, y - 1) || !wet(x, y + 1);
      const nearLand = !wet(x - 2, y) || !wet(x + 2, y) || !wet(x, y - 2) || !wet(x, y + 2);
      let colour = isPond ? COLORS.pond : COLORS.water;
      if (isPond) {
        if (y > POND.c.y + 8 && hash(x, y, 2) < 0.07) colour = COLORS.pondDeep;
        if (nearLand && !touchesLand) colour = COLORS.pondLight;
        else if (!nearLand && (x * 7 + y * 3) % 23 === 0 && hash(x, y, 9) < 0.5) colour = COLORS.pondLight;
      } else {
        // Ripples: short bright dashes placed on a loose grid.
        const xs = x + phase * 2;
        const seed = hash(Math.floor(xs / 5), Math.floor(y / 4), 4);
        if (seed < 0.2 && y % 4 === 1 && xs % 5 < 3 && !nearLand) colour = COLORS.ripple;
        else if (seed > 0.9 && y % 4 === 3 && xs % 5 < 2 && !nearLand) colour = COLORS.waterDeep;
        if (nearLand && !touchesLand) colour = COLORS.waterLight;
      }
      put(x, y, colour);
    }
  }
  // Bank line on the land side; a darker grass fringe sits just above the north bank like a cast shadow.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (wet(x, y)) continue;
      const wetBelow = wet(x, y + 1);
      if (!(wet(x - 1, y) || wet(x + 1, y) || wet(x, y - 1) || wetBelow)) continue;
      const nearPond = pond.get(x, y + 1) || pond.get(x - 1, y) || pond.get(x + 1, y) || pond.get(x, y - 1);
      put(x, y, nearPond ? COLORS.pondLine : COLORS.bankLine);
      if (wetBelow && !wet(x, y - 1)) put(x, y - 1, hash(x, y, 6) < 0.5 ? COLORS.grassDark : COLORS.grass);
    }
  }

  // Frame
  for (let i = 0; i < FRAME; i++) {
    const c = i === FRAME - 1 ? COLORS.frameLight : COLORS.frame;
    for (let k = 0; k < size; k++) { put(k, i, c); put(k, size - 1 - i, c); put(i, k, c); put(size - 1 - i, k, c); }
  }
  ctx.putImageData(image, 0, 0);
}

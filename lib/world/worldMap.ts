/*
 * Authored geography for the Neural Frontier overworld.
 *
 * The map is a 576 x 576 art-pixel world. Landmarks, rivers and paths are placed by hand in the
 * 1080-unit coordinate space of the layout reference (see design-ref/map.png) and scaled down with `K`,
 * so the composition follows the reference while every pixel is painted by this project.
 * Nothing here is random at run time: forests use a seeded generator, so a reload never rearranges the world.
 */

export const WORLD_SIZE = 576;
export const K = WORLD_SIZE / 1080;
/** Width of the dark frame painted around the world. */
export const FRAME = 4;

export interface Point { x: number; y: number }
const pt = (x: number, y: number): Point => ({ x: Math.round(x * K), y: Math.round(y * K) });
const pts = (list: readonly (readonly [number, number])[]) => list.map(([x, y]) => pt(x, y));

/* ----------------------------------------------------------------------------------------- water */

/** East shoreline of the long river down the left edge. The water fills everything west of it. */
export const WEST_RIVER_BANK: Point[] = pts([
  [70, 0], [78, 50], [96, 110], [92, 170], [100, 205], [108, 262], [114, 330], [132, 382], [140, 432], [160, 482],
  [180, 540], [187, 620], [182, 680], [162, 722], [147, 782], [140, 860], [122, 930], [112, 1000], [106, 1080],
]);

/** Centreline and half-width of the river that crosses the upper part of the world. */
export const NORTH_RIVER: { c: Point; half: number }[] = [
  [96, 216, 26], [150, 224, 26], [220, 224, 27], [300, 238, 28], [380, 244, 28], [460, 238, 28], [540, 226, 27],
  [610, 214, 27], [680, 206, 26], [750, 214, 26], [820, 218, 26], [890, 205, 26], [950, 178, 26], [1000, 150, 26], [1085, 126, 26],
].map(([x, y, h]) => ({ c: pt(x, y), half: Math.round(h * K) }));

export const POND = { c: pt(432, 1010), rx: Math.round(138 * K), ry: Math.round(58 * K) };

export const WATER_ROCKS: Point[] = pts([[65, 385], [85, 535], [80, 630], [65, 765]]);

/* ----------------------------------------------------------------------------------------- paths */

/** Dirt trails. Each is a polyline of centre points; the painter gives them a width and a hand-drawn edge. */
export const PATHS: { id: string; points: Point[] }[] = [
  { id: "castle-trail", points: pts([[128, 24], [136, 90], [152, 150], [168, 200], [172, 262], [176, 330], [182, 386]]) },
  { id: "west-loop", points: pts([[182, 386], [186, 440], [204, 520], [214, 588], [240, 632], [290, 640]]) },
  { id: "forest-spur", points: pts([[182, 386], [240, 382], [300, 360], [340, 322], [380, 292]]) },
  { id: "ruin-road", points: pts([[240, 632], [262, 592], [300, 552], [360, 522], [430, 488], [507, 466]]) },
  { id: "tower-to-foundry", points: pts([[507, 466], [545, 545], [562, 610], [620, 646], [700, 666], [790, 642], [860, 606]]) },
  { id: "house-lane", points: pts([[800, 540], [806, 600], [790, 642]]) },
  { id: "cave-trail", points: pts([[545, 545], [578, 505], [606, 470]]) },
  { id: "grove-trail", points: pts([[240, 632], [226, 700], [230, 770], [236, 806]]) },
  { id: "training-trail", points: pts([[790, 642], [800, 704], [812, 770], [842, 836], [884, 884]]) },
  { id: "north-trail", points: pts([[240, 46], [330, 76], [430, 102], [520, 138], [566, 152]]) },
  { id: "river-lane", points: pts([[590, 246], [572, 292], [520, 306], [470, 312]]) },
  { id: "bridge-trail", points: pts([[330, 76], [333, 150], [335, 206]]) },
  { id: "bridge-trail-south", points: pts([[335, 276], [342, 300], [340, 322]]) },
];

/** Bridges: where the trails cross the north river. */
export const BRIDGES: Point[] = pts([[172, 224], [335, 242]]);

/** Where the explorer stops for each region. The walker snaps these to the nearest trail junction and finishes in a straight line. */
export const STOPS = {
  gate: pt(168, 184),
  grove: pt(236, 806),
  cave: pt(606, 472),
  foundry: pt(860, 606),
  training: pt(884, 884),
} as const;
export type StopId = keyof typeof STOPS;

/* ----------------------------------------------------------------------------------------- regions */

export type RegionId = "grove" | "caves" | "foundry" | "training" | "frontier";
export interface Region {
  id: RegionId;
  number: string;
  name: string;
  /** Where the explorer stands when they arrive. */
  stop: StopId;
  /** Centre of the landmark, used for the label, the click target and the camera focus. */
  anchor: Point;
  radius: number;
  description: string;
  topics: readonly string[];
  lessonIds: readonly string[];
}

export const REGIONS: readonly Region[] = [
  { id: "grove", number: "01", name: "Neuron Grove", stop: "grove", anchor: pt(236, 790), radius: 34, description: "Every network starts somewhere. Meet the small building block that turns inputs into useful outputs.", topics: ["Inputs", "Weights", "Bias", "Activation"], lessonIds: ["neuron-basics"] },
  { id: "caves", number: "02", name: "Activation Caves", stop: "cave", anchor: pt(640, 440), radius: 34, description: "Follow the crystals into the hills and see how activation functions shape a neuron's response.", topics: ["Identity", "ReLU", "Sigmoid", "Curves"], lessonIds: [] },
  { id: "foundry", number: "03", name: "Network Foundry", stop: "foundry", anchor: pt(850, 560), radius: 40, description: "A cluster of workshops for connecting neurons into layers and complete networks.", topics: ["Layers", "Connections", "Architecture"], lessonIds: [] },
  { id: "training", number: "04", name: "Training Grounds", stop: "training", anchor: pt(884, 868), radius: 36, description: "A practice field in the foothills for learning from examples, errors, and repeated adjustments.", topics: ["Training data", "Loss", "Gradient descent", "Backpropagation"], lessonIds: [] },
  { id: "frontier", number: "05", name: "Agent Frontier", stop: "gate", anchor: pt(200, 120), radius: 44, description: "The trail ends at a distant castle, where a trained model will one day make decisions of its own.", topics: ["Model decisions", "Agent inputs", "Evaluation"], lessonIds: [] },
];

export const START_STOP = "grove" as const;

/* ----------------------------------------------------------------------------------------- objects */

export interface WorldObject {
  sprite: string;
  /** Foot position (the point that touches the ground) in world pixels. Drawing order follows `y`. */
  x: number;
  y: number;
  shadow?: boolean;
}

function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function distToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
const distToPolyline = (p: Point, line: Point[]) => {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) best = Math.min(best, distToSegment(p, line[i], line[i + 1]));
  return best;
};

/** x of the west river's east bank at height y. */
export function westBankAt(y: number): number {
  for (let i = 0; i + 1 < WEST_RIVER_BANK.length; i++) {
    const a = WEST_RIVER_BANK[i];
    const b = WEST_RIVER_BANK[i + 1];
    if (y >= a.y && y <= b.y) return a.x + ((y - a.y) / Math.max(1, b.y - a.y)) * (b.x - a.x);
  }
  return WEST_RIVER_BANK[WEST_RIVER_BANK.length - 1].x;
}

export function inWater(x: number, y: number, margin = 0): boolean {
  if (x < westBankAt(y) + margin) return true;
  for (let i = 0; i + 1 < NORTH_RIVER.length; i++) {
    const a = NORTH_RIVER[i];
    const b = NORTH_RIVER[i + 1];
    if (x >= a.c.x - margin && x <= b.c.x + margin) {
      const t = (x - a.c.x) / Math.max(1, b.c.x - a.c.x);
      const cy = a.c.y + t * (b.c.y - a.c.y);
      const half = a.half + t * (b.half - a.half);
      if (Math.abs(y - cy) < half + margin) return true;
    }
  }
  const px = (x - POND.c.x) / (POND.rx + margin);
  const py = (y - POND.c.y) / (POND.ry + margin);
  return px * px + py * py < 1;
}

export const PATH_HALF_WIDTH = 8;
const onPath = (p: Point, margin: number) => PATHS.some((path) => distToPolyline(p, path.points) < PATH_HALF_WIDTH + margin);

/** Keep-clear zones around landmarks so forests grow around them instead of over them. */
const CLEARINGS: { c: Point; r: number }[] = [
  { c: pt(507, 430), r: 34 }, { c: pt(200, 110), r: 74 }, { c: pt(425, 592), r: 56 }, { c: pt(236, 810), r: 58 },
  { c: pt(850, 580), r: 70 }, { c: pt(884, 868), r: 48 }, { c: pt(600, 150), r: 40 }, { c: pt(640, 235), r: 40 },
  { c: pt(335, 242), r: 22 }, { c: pt(172, 224), r: 20 },
];
const blockedFor = (p: Point, margin: number) => inWater(p.x, p.y, margin) || onPath(p, margin) || CLEARINGS.some((z) => Math.hypot(p.x - z.c.x, p.y - z.c.y) < z.r);

function forest(cx: number, cy: number, rx: number, ry: number, spacing: number, seed: number, kinds: readonly string[], objects: WorldObject[]) {
  const rand = mulberry(seed);
  const c = pt(cx, cy);
  const rX = rx * K;
  const rY = ry * K;
  const step = spacing * K;
  const placed: WorldObject[] = [];
  for (let y = c.y - rY; y <= c.y + rY; y += step * 0.82) {
    const row = Math.round((y - (c.y - rY)) / (step * 0.82));
    for (let x = c.x - rX + (row % 2) * step * 0.5; x <= c.x + rX; x += step) {
      const jitter = { x: x + (rand() - 0.5) * step * 0.45, y: y + (rand() - 0.5) * step * 0.4 };
      const nx = (jitter.x - c.x) / rX;
      const ny = (jitter.y - c.y) / rY;
      // A ragged edge: the radius wobbles per tree so forests are not perfect ovals.
      if (nx * nx + ny * ny > 0.78 + rand() * 0.32) continue;
      const p = { x: Math.round(jitter.x), y: Math.round(jitter.y) };
      if (p.x < FRAME + 14 || p.x > WORLD_SIZE - FRAME - 14 || p.y < FRAME + 30 || p.y > WORLD_SIZE - FRAME - 3) continue;
      if (blockedFor(p, 8)) continue;
      placed.push({ sprite: kinds[Math.floor(rand() * kinds.length)], x: p.x, y: p.y, shadow: true });
    }
  }
  objects.push(...placed);
}

function build(): WorldObject[] {
  const o: WorldObject[] = [];
  const put = (sprite: string, x: number, y: number, shadow = true) => {
    const p = pt(x, y);
    o.push({ sprite, x: p.x, y: p.y, shadow });
  };
  const round = ["tree-round-a", "tree-round-b", "tree-round-c", "tree-small-a", "tree-round-a", "tree-round-b"];
  const orchard = ["tree-apple-a", "tree-apple-b", "tree-round-a", "tree-apple-a"];

  /* Forests: dense stands with clear edges, as in the reference. */
  forest(400, 360, 112, 112, 54, 11, round, o);
  forest(365, 735, 158, 108, 54, 23, round, o);
  forest(765, 118, 96, 72, 58, 31, round, o);
  forest(955, 405, 82, 98, 54, 47, orchard, o);
  forest(790, 992, 128, 62, 54, 59, orchard, o);

  /* Conifers */
  put("cypress-grove-a", 925, 818);
  put("cypress-grove-b", 507, 640);
  put("pine-a", 702, 456);
  put("pine-a", 744, 432);
  put("pine-b", 620, 108);
  put("pine-a", 666, 112);
  put("pine-a", 266, 676);
  put("pine-b", 160, 860);

  /* Hills */
  put("mound-a", 455, 188);
  put("mound-b", 384, 204);
  put("mound-a", 926, 112);
  put("mound-b", 968, 98);
  put("mound-b", 996, 268);
  put("mound-a", 248, 514);
  put("mound-b", 206, 494);
  put("mound-a", 706, 604);
  put("mound-b", 656, 574);
  put("mound-c", 658, 612);
  put("mound-a", 232, 948);
  put("mound-b", 186, 934);
  put("mound-b", 154, 1016);
  put("mound-a", 222, 1024);
  put("mound-c", 1015, 560);

  /* Mountains: the upper range hides the Activation Caves, the lower range shelters the foothills. */
  put("mountain-l", 610, 452);
  put("mountain-s", 738, 392);
  put("mountain-m", 696, 424);
  put("mountain-l", 792, 360);
  put("mountain-xl", 522, 932);
  put("mountain-l", 603, 892);
  put("mountain-l", 664, 862);
  put("mountain-l", 562, 826);
  put("mountain-m", 628, 772);
  put("mountain-m", 668, 800);
  put("cave-mouth", 652, 458);
  put("crystals", 590, 478);
  put("crystals", 706, 470);
  put("sign", 602, 502);

  /* Buildings */
  put("house-white", 600, 150);
  put("house-white-flip", 640, 244);
  put("house-gray-a", 800, 534);
  put("house-gray-b", 926, 614);
  put("house-gray-a", 770, 750);
  put("stone-tower", 507, 460);
  put("castle", 200, 152);
  put("ruin", 425, 622);
  put("ruin-pillar", 150, 172);
  put("ruin-pillar", 264, 176);
  put("ruin-pillar", 452, 640);

  /* Neuron Grove: a campsite in the south-west clearing */
  put("sign", 214, 792);
  put("lantern", 262, 784);
  put("campfire", 196, 838);
  put("tent", 300, 862);
  put("stump", 296, 818);
  put("mushroom", 304, 830);
  put("field-chest", 186, 812);
  put("flowering-bush", 168, 770);
  put("tent", 340, 892);
  put("tent", 416, 832);
  put("tent", 422, 892);

  /* Network Foundry */
  put("lantern", 846, 650);
  put("sign", 830, 664);
  put("fence-section", 740, 770);
  put("fence-section", 802, 784);
  put("field-chest", 700, 700);

  /* Training Grounds */
  put("training-target", 846, 876);
  put("training-target", 904, 840);
  put("fence-section", 840, 924);
  put("hay-mound-a", 778, 858);
  put("hay-mound-b", 900, 912);
  put("hay-mound-a", 996, 904);
  put("hay-mound-b", 978, 992);
  put("lantern", 948, 902);

  /* Pond and the southern tents */
  put("tent", 618, 962);
  put("tent", 692, 924);
  put("hay-mound-a", 590, 988);
  put("hay-mound-b", 614, 1030);
  put("hay-mound-a", 646, 1056);
  put("pond-flowers", 296, 944, false);
  put("pond-flowers", 480, 934, false);
  put("rock-b", 560, 960);
  put("rock-a", 280, 940);

  /* Small rocks and loose details so open grass still has something to look at */
  for (const [s, x, y] of [
    ["rock-a", 420, 190], ["rock-a", 880, 470], ["rock-b", 180, 300], ["rock-a", 470, 780], ["rock-a", 330, 585],
    ["rock-a", 1040, 700], ["rock-a", 232, 650], ["rock-b", 760, 968], ["rock-a", 1010, 480],
    ["flowers-pink", 300, 440], ["flowers-white", 560, 700], ["flowers-yellow", 760, 590], ["flowers-pink", 430, 302],
    ["flowers-white", 900, 760], ["flowers-yellow", 270, 280], ["flowers-pink", 1000, 640], ["flowers-white", 330, 610],
    ["flowers-yellow", 232, 560], ["flowers-pink", 680, 150], ["flowers-white", 820, 420], ["flowers-yellow", 520, 270],
    ["tall-grass", 230, 700], ["tall-grass", 640, 530], ["tall-grass", 400, 760], ["tall-grass", 800, 90], ["tall-grass", 1030, 380],
    ["tall-grass", 250, 1060], ["tall-grass", 320, 150], ["tall-grass", 760, 700], ["tall-grass", 200, 440], ["sapling", 360, 210],
    ["sapling", 560, 570], ["sapling", 960, 520], ["sapling", 140, 880], ["sapling", 1000, 840], ["sapling", 700, 990],
  ] as [string, number, number][]) put(s, x, y, s.startsWith("rock") || s === "sapling");
  for (const p of WATER_ROCKS) o.push({ sprite: "rocks-water", x: p.x + 4, y: p.y + 7, shadow: false });
  for (const b of BRIDGES) o.push({ sprite: "bridge", x: b.x, y: b.y + 19, shadow: false });
  return o;
}

let cached: WorldObject[] | null = null;
export function worldObjects(): readonly WorldObject[] {
  return (cached ??= build());
}

/** Sprites that lie flat on the ground and are drawn under the player whatever the depth order. */
export const GROUND_SPRITES = new Set(["bridge", "pond-flowers", "flowers-pink", "flowers-white", "flowers-yellow", "tall-grass", "rocks-water"]);

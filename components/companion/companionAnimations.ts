import { ART, GRID_H, GRID_W } from "./characterArt";
import type { CharacterArt, Rows } from "./characterArt";
import type { AnimationState, CompanionId, Frame, Pixel } from "./companionTypes";

/*
 * Frame builder. Poses are assembled from the hand-drawn parts in characterArt.ts
 * (head, torso, two arms, legs, held items), so every state is a different drawing,
 * not a transformed standing sprite.
 */

export { GRID_H, GRID_W };
/** Horizontal centre of the body in grid units; positions refer to this point. */
export const BODY_CENTER_X = GRID_W / 2;

type ArmPose = "down" | "up" | "forward" | "reach";
type LegPose = "stand" | "dangle" | "tuck" | "stepL" | "stepR";
type Prop = "magnifier" | "laptop" | "sparksA" | "sparksB";

interface Pose {
  /** Vertical offset of head, torso and arms (idle breathing, crouch). */
  by?: number;
  legs?: LegPose;
  armL?: ArmPose;
  armR?: ArmPose;
  /** Vertical nudge of each arm, used for the walk swing. */
  swingL?: number;
  swingR?: number;
  /** Eyes closed (the adventurer only). */
  blink?: boolean;
  flame?: number;
  /** Held items are drawn over the arms unless hidden. */
  sword?: boolean;
  shield?: boolean;
  torch?: boolean;
  /** Raised arms carry the held item with them. */
  liftL?: boolean;
  liftR?: boolean;
  /** Extra rows of reach for the hang pose. */
  reach?: number;
  /** Move the whole rig down (sitting body drop, hang). */
  dropY?: number;
  props?: Prop[];
}

type Grid = (string | null)[][];

const stamp = (grid: Grid, rows: Rows | undefined, x: number, y: number) => {
  if (!rows) return;
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const ch = row[dx];
      const gx = x + dx;
      const gy = y + dy;
      if (ch !== "." && gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H) grid[gy][gx] = ch;
    }
  });
};

/** Centre a part on the grid. All parts that are centred use an even width. */
const centreX = (rows: Rows) => Math.floor((GRID_W - rows[0].length) / 2);

/** Raise one half of a legs part by `lift` rows, for a stepping leg. */
function liftLeg(rows: Rows, side: "L" | "R", lift: number): Rows {
  const half = rows[0].length / 2;
  const cut = (row: string) => (side === "L" ? [row.slice(0, half), row.slice(half)] : [row.slice(half), row.slice(0, half)]);
  const moving: string[] = [];
  const staying: string[] = [];
  for (const row of rows) {
    const [m, s] = cut(row);
    moving.push(m);
    staying.push(s);
  }
  // Drop the stepping half's top rows so its boot rises, then pad the bottom with air.
  const raised = [...moving.slice(lift), ...Array(lift).fill(".".repeat(half))];
  return rows.map((_, i) => (side === "L" ? raised[i] + staying[i] : staying[i] + raised[i]));
}

/** Insert extra forearm rows so a raised arm reaches a ledge above the head. */
function reachArm(rows: Rows, extra: number): Rows {
  const forearm = rows[Math.max(0, rows.length - 4)];
  return [...rows.slice(0, 2), ...Array(extra).fill(forearm), ...rows.slice(2)];
}

const MAGNIFIER: readonly Pixel[] = [
  [1, 9, 6, 1, "#eef0f2"], [1, 15, 6, 1, "#eef0f2"], [0, 10, 1, 5, "#eef0f2"], [7, 10, 1, 5, "#eef0f2"],
  [1, 10, 6, 5, "#7d93f5"], [2, 11, 2, 1, "#c7d2ff"], [3, 16, 2, 2, "#8b5a2b"], [3, 18, 2, 5, "#8b5a2b"],
];
const LAPTOP: readonly Pixel[] = [
  [6, 20, 12, 7, "#2a2d34"], [7, 21, 10, 5, "#55606d"], [10, 22, 4, 2, "#2547e8"], [4, 27, 16, 1, "#1b1d22"], [5, 28, 14, 1, "#55606d"],
];
const LIME = "#c6f04a";
const SPARKS_A: readonly Pixel[] = [[1, 4, 1, 1, LIME], [21, 2, 1, 1, LIME], [22, 9, 1, 1, LIME], [3, 10, 1, 1, LIME]];
const SPARKS_B: readonly Pixel[] = [[2, 2, 1, 1, LIME], [20, 5, 1, 1, LIME], [0, 8, 1, 1, LIME], [23, 13, 1, 1, LIME]];
const PROPS: Record<Prop, readonly Pixel[]> = { magnifier: MAGNIFIER, laptop: LAPTOP, sparksA: SPARKS_A, sparksB: SPARKS_B };

/** Rows from the top of a raised arm to its shoulder. */
const UP_SHOULDER = 3;

/** Compose one pose into pixel rectangles. Also used by the world renderer through `getAnimations`. */
export function composePose(art: CharacterArt, pose: Pose): Pixel[] {
  const grid: Grid = Array.from({ length: GRID_H }, () => Array<string | null>(GRID_W).fill(null));
  const by = (pose.by ?? 0) + (pose.dropY ?? 0);
  const legsDy = pose.dropY ?? 0;
  const legMode = pose.legs ?? "stand";

  // Legs
  if (legMode === "stand") stamp(grid, art.legs.stand, centreX(art.legs.stand), art.legsY + legsDy);
  else if (legMode === "stepL") stamp(grid, liftLeg(art.legs.stand, "L", 3), centreX(art.legs.stand), art.legsY + legsDy);
  else if (legMode === "stepR") stamp(grid, liftLeg(art.legs.stand, "R", 3), centreX(art.legs.stand), art.legsY + legsDy);
  else if (legMode === "tuck") stamp(grid, art.legs.tuck, centreX(art.legs.tuck), art.legsY + legsDy - 2);
  else stamp(grid, art.legs.dangle, centreX(art.legs.dangle), art.legsY + legsDy);

  // Torso, then arms, then head (the head overlaps raised arms)
  stamp(grid, art.torso, centreX(art.torso), art.torsoY + by);
  const armOf = (set: CharacterArt["armL"], mode: ArmPose): Rows => (mode === "reach" ? reachArm(set.up, pose.reach ?? 10) : set[mode]);
  const armY = (mode: ArmPose, swing: number) => {
    if (mode === "reach") return art.torsoY + by - UP_SHOULDER - (pose.reach ?? 10) + swing;
    if (mode === "up") return art.torsoY + by - UP_SHOULDER + swing;
    return art.torsoY + by + swing;
  };
  const modeL = pose.armL ?? "down";
  const modeR = pose.armR ?? "down";
  stamp(grid, armOf(art.armL, modeL), art.armLX, armY(modeL, pose.swingL ?? 0));
  stamp(grid, armOf(art.armR, modeR), art.armRX, armY(modeR, pose.swingR ?? 0));
  stamp(grid, art.head, centreX(art.head), art.headY + by);

  // Blink: close the adventurer's eyes. The knight's visor has no eyes, so it only gets the pause between breaths.
  if (pose.blink && art.id === "sol") {
    const hy = art.headY + by;
    const hx = centreX(art.head);
    for (const ex of [3, 8]) {
      grid[hy + 6][hx + ex] = "F";
      grid[hy + 7][hx + ex] = "f";
    }
  }

  // Held items
  const liftDy = -10;
  if (art.heldL && pose.sword !== false) {
    stamp(grid, art.heldL, art.heldLX ?? 0, (art.heldLY ?? 12) + by + (pose.liftL ? liftDy : 0));
  }
  if (art.heldR) {
    const isTorch = art.id === "sol";
    const show = isTorch ? pose.torch !== false : pose.shield !== false;
    if (show) {
      const dy = (art.heldRY ?? 18) + by + (pose.liftR ? (isTorch ? -7 : liftDy) : 0);
      stamp(grid, art.heldR, art.heldRX ?? 18, dy);
      if (isTorch && art.flame) {
        const flame = art.flame[(pose.flame ?? 0) % art.flame.length];
        stamp(grid, flame, (art.heldRX ?? 18), dy - flame.length);
      }
    }
  }

  // Convert to rectangles: merge runs along rows, then merge identical runs on consecutive rows.
  const rects: Pixel[] = [];
  const open = new Map<string, number>();
  for (let y = 0; y <= GRID_H; y++) {
    const runs = new Map<string, [number, number, string]>();
    if (y < GRID_H) {
      let x = 0;
      while (x < GRID_W) {
        const ch = grid[y][x];
        if (!ch) { x++; continue; }
        let end = x;
        while (end + 1 < GRID_W && grid[y][end + 1] === ch) end++;
        runs.set(`${x}:${end - x + 1}:${ch}`, [x, end - x + 1, ch]);
        x = end + 1;
      }
    }
    for (const [key, startY] of [...open]) {
      if (!runs.has(key)) {
        const [x, w, ch] = [Number(key.split(":")[0]), Number(key.split(":")[1]), key.split(":")[2]];
        rects.push([x, startY, w, y - startY, art.palette[ch]]);
        open.delete(key);
      }
    }
    for (const key of runs.keys()) if (!open.has(key)) open.set(key, y);
  }

  for (const name of pose.props ?? []) {
    for (const [x, y, w, h, c] of PROPS[name]) rects.push([x, y + (name === "magnifier" || name === "laptop" ? by : 0), w, h, c]);
  }
  return rects;
}

/** Grid row of the sprite that rests on the target line. Sitting rests on the seat, hanging on the ledge. */
export function anchorRow(character: CompanionId, state: AnimationState): number {
  const art = ART[character];
  switch (state) {
    case "hang": return 3;
    case "sit":
    case "work": return art.legsY;
    default: return GRID_H;
  }
}
export const JUMP_FRAME = { crouch: 0, up: 1, apex: 2, down: 3, land: 4 } as const;

const CROUCH: Pose = { by: 2, legs: "tuck" };

function build(character: CompanionId): Record<AnimationState, Frame[]> {
  const art = ART[character];
  const flames = art.flame?.length ?? 1;
  const f = (pose: Pose, ms: number): Frame => ({ pixels: composePose(art, pose), ms });
  const isSol = character === "sol";

  // Idle: a slow breath. The adventurer's torch flickers on every beat.
  const idle: Frame[] = isSol
    ? [
        f({ flame: 0 }, 260), f({ flame: 1 }, 260), f({ flame: 2 }, 260), f({ flame: 1 }, 260),
        f({ flame: 0, by: 1 }, 260), f({ flame: 2, by: 1 }, 260), f({ flame: 1, by: 1 }, 260), f({ flame: 0 }, 260),
        f({ flame: 1 }, 260), f({ flame: 2 }, 260), f({ flame: 0, blink: true }, 140), f({ flame: 1 }, 260),
      ]
    : [f({}, 1400), f({ by: 1 }, 760), f({}, 1300), f({ by: 1 }, 760)];

  const fl = (n: number) => n % flames;
  const walkFrame = (legs: LegPose, by: number, swingL: number, swingR: number, n: number, ms = 120): Frame =>
    f({ legs, by, swingL, swingR, flame: fl(n) }, ms);

  const sit = (extra: Partial<Pose>): Pose => ({ legs: "dangle", armL: "down", armR: "down", ...extra });
  const hang = (legs: LegPose, extra: Partial<Pose> = {}): Pose => ({
    legs, armL: "reach", armR: "reach", reach: 10, sword: false, shield: false, torch: false, ...extra,
  });
  const cheer = (extra: Partial<Pose>): Pose => ({ armL: "up", armR: "up", liftL: true, liftR: true, ...extra });

  return {
    idle,
    walk: [
      walkFrame("stand", 1, -1, 1, 0),
      walkFrame("stepR", 0, 1, -1, 1),
      walkFrame("stand", 1, 1, -1, 2),
      walkFrame("stepL", 0, -1, 1, 0),
    ],
    jump: [
      f(CROUCH, 130),
      f({ by: -1, legs: "tuck", armL: "down", armR: "down", swingL: -1, swingR: -1 }, 140),
      f({ by: -2, legs: "tuck", ...cheer({}) }, 140),
      f({ by: 0, legs: "stand", swingL: -1, swingR: -1 }, 140),
      f({ ...CROUCH, by: 2 }, 150),
    ],
    inspect: [
      f({ armL: "forward", sword: false, torch: true, props: ["magnifier"], flame: 0 }, 420),
      f({ armL: "forward", sword: false, torch: true, props: ["magnifier"], by: 1, flame: 1 }, 420),
      f({ armL: "forward", sword: false, torch: true, props: ["magnifier"], flame: 2 }, 420),
      f({ armL: "forward", sword: false, torch: true, props: ["magnifier"], by: 1, flame: 1 }, 420),
    ],
    hang: [f(hang("dangle"), 600), f(hang("dangle", { by: 1 }), 600), f(hang("tuck", { by: 1 }), 600), f(hang("dangle"), 600)],
    sit: [
      f(sit({ flame: 0 }), 420), f(sit({ flame: 1, by: 1 }), 420), f(sit({ flame: 2 }), 420), f(sit({ flame: 1, by: 1 }), 420),
      f(sit({ flame: 0, blink: true }), 140), f(sit({ flame: 2 }), 420),
    ],
    work: [
      f(sit({ armL: "forward", armR: "forward", swingL: 0, swingR: 1, sword: false, torch: false, by: 1, props: ["laptop"] }), 240),
      f(sit({ armL: "forward", armR: "forward", swingL: 1, swingR: 0, sword: false, torch: false, by: 1, props: ["laptop"] }), 240),
    ],
    celebrate: [
      f(CROUCH, 130),
      f({ by: -1, legs: "tuck", ...cheer({ flame: 0 }), props: ["sparksA"] }, 200),
      f({ by: -2, legs: "tuck", ...cheer({ flame: 1 }), props: ["sparksB"] }, 200),
      f({ by: 0, legs: "stand", ...cheer({ flame: 2 }), props: ["sparksA"] }, 160),
      f({ by: 0, legs: "stand", ...cheer({ flame: 1 }), props: ["sparksB"] }, 160),
    ],
  };
}

const cache = new Map<CompanionId, Record<AnimationState, Frame[]>>();
export function getAnimations(character: CompanionId) {
  let animations = cache.get(character);
  if (!animations) cache.set(character, (animations = build(character)));
  return animations;
}

/** States that loop; the rest hold their last frame. */
export const LOOPING: Record<AnimationState, boolean> = {
  idle: true, walk: true, jump: false, inspect: true, hang: true, sit: true, work: true, celebrate: true,
};

import type { AnimationState, CompanionId, Frame, Pixel } from "./companionTypes";

/*
 * Side-view rig for Rune and Sol, drawn on a 20 x 24 pixel grid and facing right.
 * Colours come from the existing front-facing artwork so the characters stay recognisable.
 * Every frame is assembled from rig parts (head, torso, two arms, two legs), so walking,
 * sitting and hanging are real poses, not a bobbing front sprite.
 */

export const GRID_W = 20;
export const GRID_H = 24;
/** Horizontal centre of the body in grid units; positions refer to this point. */
export const BODY_CENTER_X = 8.5;

interface Palette {
  hair: string; hairDark: string; skin: string; skinShade: string; eye: string; mouth: string;
  coat: string; coatDark: string; belt: string; pants: string; pantsDark: string; boot: string; bag: string;
  trim: Pixel[]; glint?: string;
}

const PALETTES: Record<CompanionId, Palette> = {
  rune: {
    hair: "#a0522d", hairDark: "#8c3e1e", skin: "#f8d5b8", skinShade: "#d9a98a", eye: "#241b17", mouth: "#d8846c",
    coat: "#f3ece3", coatDark: "#c9bfb3", belt: "#354a68", pants: "#3d5578", pantsDark: "#2d3f5a", boot: "#6b4630", bag: "#6d4c3d",
    trim: [[8, 8, 3, 2, "#f3701e"], [9, 12, 1, 3, "#7fa5d8"]],
  },
  sol: {
    hair: "#2d6e85", hairDark: "#1b4958", skin: "#efd1ba", skinShade: "#cfa88f", eye: "#182c35", mouth: "#c47864",
    coat: "#3b4b5e", coatDark: "#2b3747", belt: "#1a202c", pants: "#374151", pantsDark: "#2a3340", boot: "#4a5568", bag: "#55606d",
    trim: [[9, 10, 1, 4, "#f3ece3"], [8, 9, 3, 1, "#f3ece3"]], glint: "#7fa5d8",
  },
};

type LegPose = { kx: number; fx: number; lift: number } | { sit: true; sw: number };
type ArmPose =
  | { kind: "swing"; s: number }
  | { kind: "forward" }
  | { kind: "up" }
  | { kind: "hang" }
  | { kind: "lap" }
  | { kind: "type"; t: number };

interface Pose {
  by?: number; // body (head + torso + arms) vertical offset
  hdy?: number; // extra head offset
  legsDy?: number;
  blink?: boolean;
  near: LegPose;
  far: LegPose;
  armNear: ArmPose;
  armFar: ArmPose;
  props?: Pixel[];
}

function leg(P: Palette, pose: LegPose, near: boolean, dy: number): Pixel[] {
  const pants = near ? P.pants : P.pantsDark;
  const boot = near ? P.boot : P.pantsDark;
  if ("sit" in pose) {
    const x = near ? 7 : 6;
    const drop = near ? 11 : 9;
    return [
      [x, 16 + dy, near ? 6 : 5, 3, pants],
      [drop + pose.sw, 19 + dy, 3, 4, pants],
      [drop + pose.sw, 23 + dy, 4, 1, boot],
    ];
  }
  const hip = near ? 7 : 5;
  return [
    [hip + pose.kx, 16 + dy, 3, 4, pants],
    [hip + pose.fx, 20 + dy, 3, Math.max(0, 3 - pose.lift), pants],
    [hip + pose.fx, 23 + dy - pose.lift, 4, 1, boot],
  ];
}

function arm(P: Palette, pose: ArmPose, by: number, near: boolean): Pixel[] {
  const sleeve = near ? P.coat : P.coatDark;
  const hand = near ? P.skin : P.skinShade;
  switch (pose.kind) {
    case "swing":
      return [[7 + Math.trunc(pose.s / 2), 10 + by, 2, 3, sleeve], [7 + pose.s, 13 + by, 2, 3, sleeve], [7 + pose.s, 16 + by, 2, 1, hand]];
    case "forward":
      return [[8, 10 + by, 2, 2, sleeve], [9, 11 + by, 4, 2, sleeve], [13, 11 + by, 1, 2, hand]];
    case "lap":
      return [[7, 10 + by, 2, 3, sleeve], [8, 13 + by, 4, 2, sleeve], [12, 13 + by, 1, 2, hand]];
    case "type":
      return [[7, 10 + by, 2, 3, sleeve], [8, 12 + by + pose.t, 5, 2, sleeve], [13, 12 + by + pose.t, 1, 2, hand]];
    case "up": {
      // Raised in front of the face so the arms stay visible against the head.
      const x = near ? 12 : 14;
      return [[10, 9 + by, near ? 3 : 5, 2, sleeve], [x, 4 + by, 2, 6, sleeve], [x, 2 + by, 2, 2, hand]];
    }
    default: // hang: grips the ledge above the head, arm passes behind the face
      return [[9, 15 + by, 3, 2, sleeve], [near ? 11 : 10, 2, 2, 13 + by - 6, sleeve], [near ? 11 : 10, 0, 2, 2, hand]];
  }
}

const behindHead = (pose: ArmPose) => pose.kind === "hang";

function render(character: CompanionId, pose: Pose): Pixel[] {
  const P = PALETTES[character];
  const by = pose.by ?? 0;
  const hd = by + (pose.hdy ?? 0);
  const ld = pose.legsDy ?? 0;
  const out: Pixel[] = [];
  out.push(...leg(P, pose.far, false, ld), ...leg(P, pose.near, true, ld));
  // bag, torso and trim
  out.push([2, 10 + by, 3, 6, P.bag]);
  out.push([5, 9 + by, 6, 7, P.coat], [5, 9 + by, 1, 7, P.coatDark], [5, 15 + by, 6, 1, P.belt]);
  for (const [x, y, w, h, c] of P.trim) out.push([x, y + by, w, h, c]);
  if (behindHead(pose.armFar)) out.push(...arm(P, pose.armFar, by, false));
  if (behindHead(pose.armNear)) out.push(...arm(P, pose.armNear, by, true));
  // head
  out.push(
    [3, 1 + hd, 4, 7, P.hairDark], [4, 0 + hd, 8, 3, P.hair], [6, 3 + hd, 6, 5, P.skin], [12, 5 + hd, 1, 1, P.skin],
    [5, 4 + hd, 1, 2, P.skinShade], [7, 8 + hd, 3, 1, P.skinShade], [10, 7 + hd, 2, 1, P.mouth],
  );
  if (pose.blink) out.push([9, 5 + hd, 3, 1, P.eye]);
  else {
    out.push([10, 4 + hd, 1, 2, P.eye]);
    if (P.glint) out.push([11, 4 + hd, 1, 1, P.glint]);
  }
  if (!behindHead(pose.armFar)) out.push(...arm(P, pose.armFar, by, false));
  if (!behindHead(pose.armNear)) out.push(...arm(P, pose.armNear, by, true));
  const all = pose.props ? [...out, ...pose.props] : out;
  return all.filter(([, , w, h]) => w > 0 && h > 0);
}

const LIME = "#c6f04a";
const magnifier = (dy: number): Pixel[] => [
  [15, 8 + dy, 2, 1, "#eef0f2"], [15, 13 + dy, 2, 1, "#eef0f2"], [14, 9 + dy, 1, 4, "#eef0f2"], [17, 9 + dy, 1, 4, "#eef0f2"],
  [15, 9 + dy, 2, 4, "#7d93f5"],
];
const LAPTOP: Pixel[] = [[10, 15, 6, 1, "#55606d"], [15, 10, 1, 5, "#191a1e"], [15, 11, 1, 2, "#2547e8"]];
const SPARKS_A: Pixel[] = [[1, 4, 1, 1, LIME], [17, 2, 1, 1, LIME], [18, 8, 1, 1, LIME]];
const SPARKS_B: Pixel[] = [[2, 2, 1, 1, LIME], [16, 4, 1, 1, LIME], [0, 8, 1, 1, LIME]];

/** Grid row of the sprite that rests on the target line. */
export const ANCHOR_ROW: Record<AnimationState, number> = {
  idle: 24, walk: 24, jump: 24, inspect: 24, celebrate: 24, hang: 0, sit: 19, work: 19,
};
export const JUMP_FRAME = { crouch: 0, up: 1, apex: 2, down: 3, land: 4 } as const;

const STAND_NEAR: LegPose = { kx: 1, fx: 1, lift: 0 };
const STAND_FAR: LegPose = { kx: -1, fx: -1, lift: 0 };
const STAND = { near: STAND_NEAR, far: STAND_FAR, armNear: { kind: "swing", s: 0 } as ArmPose, armFar: { kind: "swing", s: -1 } as ArmPose };
const CROUCH: Pose = { by: 2, near: { kx: 2, fx: -1, lift: 0 }, far: { kx: 0, fx: -3, lift: 0 }, armNear: { kind: "swing", s: -2 }, armFar: { kind: "swing", s: -2 } };

function build(character: CompanionId): Record<AnimationState, Frame[]> {
  const f = (pose: Pose, ms: number): Frame => ({ pixels: render(character, pose), ms });
  const sit = (nearSw: number, farSw: number, extra: Partial<Pose> = {}): Pose => ({
    near: { sit: true, sw: nearSw }, far: { sit: true, sw: farSw }, armNear: { kind: "lap" }, armFar: { kind: "lap" }, ...extra,
  });
  const hang = (n: number, fa: number): Pose => ({
    by: 7, legsDy: 7, near: { kx: n, fx: n, lift: 0 }, far: { kx: fa - 1, fx: fa - 1, lift: 0 }, armNear: { kind: "hang" }, armFar: { kind: "hang" },
  });
  return {
    idle: [
      f({ ...STAND }, 1500), f({ ...STAND, by: 1 }, 800), f({ ...STAND }, 1300), f({ ...STAND, blink: true }, 130),
      f({ ...STAND }, 1700), f({ ...STAND, by: 1 }, 800), f({ ...STAND, blink: true }, 130),
    ],
    walk: [
      f({ by: 1, near: { kx: 3, fx: 4, lift: 0 }, far: { kx: -3, fx: -4, lift: 0 }, armNear: { kind: "swing", s: -2 }, armFar: { kind: "swing", s: 2 } }, 120),
      f({ by: 0, near: { kx: 1, fx: 1, lift: 0 }, far: { kx: 0, fx: -1, lift: 3 }, armNear: { kind: "swing", s: -1 }, armFar: { kind: "swing", s: 1 } }, 120),
      f({ by: 1, near: { kx: -3, fx: -4, lift: 0 }, far: { kx: 3, fx: 4, lift: 0 }, armNear: { kind: "swing", s: 2 }, armFar: { kind: "swing", s: -2 } }, 120),
      f({ by: 0, near: { kx: 0, fx: -1, lift: 3 }, far: { kx: 1, fx: 1, lift: 0 }, armNear: { kind: "swing", s: 1 }, armFar: { kind: "swing", s: -1 } }, 120),
    ],
    jump: [
      f(CROUCH, 130),
      f({ by: -1, near: { kx: 2, fx: 1, lift: 3 }, far: { kx: 0, fx: -2, lift: 3 }, armNear: { kind: "swing", s: 2 }, armFar: { kind: "swing", s: 2 } }, 140),
      f({ by: -2, near: { kx: 3, fx: 3, lift: 3 }, far: { kx: -1, fx: -3, lift: 4 }, armNear: { kind: "up" }, armFar: { kind: "up" } }, 140),
      f({ by: 0, near: { kx: 2, fx: 3, lift: 1 }, far: { kx: 0, fx: -1, lift: 1 }, armNear: { kind: "swing", s: -2 }, armFar: { kind: "swing", s: -1 } }, 140),
      f({ ...CROUCH, by: 2 }, 150),
    ],
    inspect: [
      f({ ...STAND, armNear: { kind: "forward" }, props: magnifier(0) }, 450),
      f({ ...STAND, by: 1, armNear: { kind: "forward" }, props: magnifier(1) }, 450),
    ],
    hang: [f(hang(0, 0), 600), f(hang(1, -1), 600), f(hang(0, 0), 600), f(hang(-1, 1), 600)],
    sit: [f(sit(0, 1), 420), f(sit(1, 0), 420), f(sit(0, 1), 420), f(sit(1, 0), 420), f(sit(0, 1, { blink: true }), 130), f(sit(1, 0), 420)],
    work: [
      f(sit(0, 1, { hdy: 1, armNear: { kind: "type", t: 0 }, armFar: { kind: "type", t: 1 }, props: LAPTOP }), 240),
      f(sit(1, 0, { hdy: 1, armNear: { kind: "type", t: 1 }, armFar: { kind: "type", t: 0 }, props: LAPTOP }), 240),
    ],
    celebrate: [
      f(CROUCH, 130),
      f({ by: -1, near: { kx: 2, fx: 1, lift: 3 }, far: { kx: 0, fx: -2, lift: 3 }, armNear: { kind: "up" }, armFar: { kind: "up" }, props: SPARKS_A }, 200),
      f({ by: -2, near: { kx: 3, fx: 3, lift: 3 }, far: { kx: -1, fx: -3, lift: 4 }, armNear: { kind: "up" }, armFar: { kind: "up" }, props: SPARKS_B }, 200),
      f({ by: 0, near: { kx: 2, fx: 3, lift: 1 }, far: { kx: 0, fx: -1, lift: 1 }, armNear: { kind: "up" }, armFar: { kind: "up" }, props: SPARKS_A }, 160),
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

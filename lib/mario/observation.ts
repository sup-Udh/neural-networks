/*
 * Observation encoder. Raw observations come from the real game snapshot
 * (public/game/mario/js/game.js, `__marioHooks.snapshot()`); nothing here is simulated.
 * Units: pixels in game coordinates (one tile = 16 px).
 *
 * Input schema v1 (order is fixed, see INPUT_SCHEMA):
 *  0 obstacle  distance to the nearest solid tile ahead at Mario's body height, within LOOKAHEAD_PX.
 *              Encoded 1 - d/LOOKAHEAD_PX (1 = touching, 0 = nothing within range).
 *  1 pit       distance to the nearest missing floor column ahead (a gap), same encoding.
 *  2 enemy     distance to the nearest living enemy ahead, within range and about Mario's height, same encoding.
 *  3 velocity  horizontal velocity / MAX_VX, clamped to [-1, 1].
 *  4 grounded  1 if standing on something, else 0.
 * "Nothing within range" is a real measurement (0), not a missing value. When Mario cannot be observed
 * meaningfully (dying, flag sequence, pipe, locked controls) the observation is `available: false`
 * and has no input vector, so no network is run on made-up numbers.
 */

export const LOOKAHEAD_PX = 96;
export const MAX_VX = 2.5;
export const TILE = 16;
export const FLOOR_ROW = 13;
export const INPUT_SCHEMA_VERSION = 1;

export const INPUT_SCHEMA = [
  { key: "obstacle", label: "Obstacle ahead", unit: "1 − dist/96px" },
  { key: "pit", label: "Pit ahead", unit: "1 − dist/96px" },
  { key: "enemy", label: "Enemy ahead", unit: "1 − dist/96px" },
  { key: "velocity", label: "Horizontal velocity", unit: "vx / 2.5" },
  { key: "grounded", label: "Grounded", unit: "0 or 1" },
] as const;
export const INPUT_SIZE = INPUT_SCHEMA.length;

export interface GameSnapshot {
  frame: number;
  viewportX: number;
  levelExitX: number;
  rows: number;
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    width: number;
    height: number;
    standing: boolean;
    power: number;
    coins: number;
    dying: boolean;
    flagging: boolean;
    exiting: boolean;
    piping: boolean;
    noInput: boolean;
  };
  enemies: { type: string; x: number; y: number; vx: number; dying: boolean }[];
  isSolid: (col: number, row: number) => boolean;
}

export interface RawObservation {
  frame: number;
  /** Pixel distances; null = nothing within LOOKAHEAD_PX. */
  obstacleDistancePx: number | null;
  pitDistancePx: number | null;
  enemyDistancePx: number | null;
  horizontalVelocity: number;
  verticalVelocity: number;
  isGrounded: boolean;
  x: number;
  y: number;
}

export type Observation =
  | { available: true; raw: RawObservation; inputs: number[] }
  | { available: false; reason: string; frame: number };

const encodeDistance = (d: number | null) => (d === null ? 0 : Math.max(0, Math.min(1, 1 - d / LOOKAHEAD_PX)));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function encodeObservation(s: GameSnapshot): Observation {
  const p = s.player;
  if (p.dying) return { available: false, reason: "Mario is dying", frame: s.frame };
  if (p.flagging || p.exiting) return { available: false, reason: "Level-complete sequence", frame: s.frame };
  if (p.piping || p.noInput) return { available: false, reason: "The game has locked the controls", frame: s.frame };

  const front = p.x + p.width;
  const firstCol = Math.floor(front / TILE);
  const lastCol = Math.floor((front + LOOKAHEAD_PX) / TILE);
  const topRow = Math.floor(p.y / TILE);
  const bottomRow = Math.floor((p.y + p.height - 1) / TILE);

  let obstacle: number | null = null;
  let pit: number | null = null;
  for (let col = firstCol; col <= lastCol; col++) {
    const dist = Math.max(0, col * TILE - front);
    if (dist > LOOKAHEAD_PX) break;
    if (obstacle === null) {
      for (let row = topRow; row <= bottomRow; row++) {
        if (s.isSolid(col, row)) {
          obstacle = dist;
          break;
        }
      }
    }
    // A pit is a column whose floor tile is missing. Skip while Mario is below floor level (already falling).
    if (pit === null && p.y < FLOOR_ROW * TILE && !s.isSolid(col, FLOOR_ROW)) pit = dist;
  }

  let enemy: number | null = null;
  for (const e of s.enemies) {
    if (e.dying) continue;
    const dx = e.x - front;
    if (dx < -TILE || dx > LOOKAHEAD_PX) continue;
    if (Math.abs(e.y - p.y) > 2 * TILE) continue;
    const d = Math.max(0, dx);
    if (enemy === null || d < enemy) enemy = d;
  }

  const raw: RawObservation = {
    frame: s.frame,
    obstacleDistancePx: obstacle,
    pitDistancePx: pit,
    enemyDistancePx: enemy,
    horizontalVelocity: p.vx,
    verticalVelocity: p.vy,
    isGrounded: p.standing,
    x: p.x,
    y: p.y,
  };
  return {
    available: true,
    raw,
    inputs: [encodeDistance(obstacle), encodeDistance(pit), encodeDistance(enemy), clamp(p.vx / MAX_VX, -1, 1), p.standing ? 1 : 0],
  };
}

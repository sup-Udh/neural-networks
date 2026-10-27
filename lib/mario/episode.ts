import type { GameSnapshot } from "./observation";

export type EpisodeStatus = "running" | "dead" | "completed";

export interface EpisodeMetrics {
  status: EpisodeStatus;
  frames: number;
  startX: number;
  maxX: number;
  /** Furthest x reached minus the starting x, in game pixels. */
  distance: number;
  /** Fraction of the way to the level exit, 0..1. */
  progress: number;
  jumps: number;
  coins: number;
  /** Score is not exposed by the game, so it is intentionally absent. */
}

/** Accumulates metrics from real snapshots. Call `observe` once per game frame. */
export class EpisodeTracker {
  private metrics: EpisodeMetrics | null = null;
  private lastFrame = -1;
  private wasGrounded = true;

  /** `fixedStartX` pins where distance is measured from (e.g. the level start, when control begins later). */
  constructor(private fixedStartX?: number) {}

  reset() {
    this.metrics = null;
    this.lastFrame = -1;
    this.wasGrounded = true;
  }

  observe(s: GameSnapshot): EpisodeMetrics {
    // The game's frame counter restarts on reset; the game also respawns after death, which starts a new episode.
    if (this.metrics && (s.frame < this.lastFrame || (this.metrics.status !== "running" && !s.player.dying && !s.player.flagging && !s.player.exiting))) {
      this.metrics = null;
    }
    this.lastFrame = s.frame;
    const p = s.player;
    if (!this.metrics) {
      this.metrics = { status: "running", frames: 0, startX: this.fixedStartX ?? p.x, maxX: p.x, distance: 0, progress: 0, jumps: 0, coins: 0 };
      this.wasGrounded = p.standing;
    }
    const m = this.metrics;
    if (m.status === "running") {
      m.frames += 1;
      m.maxX = Math.max(m.maxX, p.x);
      m.distance = m.maxX - m.startX;
      m.progress = s.levelExitX > m.startX ? Math.min(1, m.distance / (s.levelExitX - m.startX)) : 0;
      m.coins = p.coins;
      if (this.wasGrounded && !p.standing && p.vy < 0) m.jumps += 1; // left the ground upward (jump or bounce)
      if (p.dying) m.status = "dead";
      else if (p.flagging || p.exiting) {
        m.status = "completed";
        m.progress = 1;
      }
    }
    this.wasGrounded = p.standing;
    return { ...m };
  }
}

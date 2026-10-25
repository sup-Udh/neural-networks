import { GRID_H, GRID_W, LOOPING, getAnimations } from "@/components/companion/companionAnimations";
import type { AnimationState, CompanionId, Frame } from "@/components/companion/companionTypes";
import { paintTerrain } from "./terrainPainter";
import { GROUND_SPRITES, PATHS, REGIONS, STOPS, WORLD_SIZE, worldObjects } from "./worldMap";
import type { Point, Region, RegionId, StopId, WorldObject } from "./worldMap";

/*
 * The overworld runtime: asset loading, the camera, the walking explorer, depth-sorted drawing and hit testing.
 * It draws to one canvas with image smoothing off and an integer number of device pixels per art pixel,
 * so the pixel art stays crisp at every window size and device pixel ratio.
 */

interface SpriteInfo { src: string; w: number; h: number; footX: number; footY: number }
type Manifest = Record<string, SpriteInfo>;

const WALK_SPEED = 78; // art pixels per second
const CELEBRATE_MS = 1100;

export interface SceneSnapshot {
  selected: RegionId | null;
  statusByRegion: Record<RegionId, "available" | "in-progress" | "completed" | "upcoming">;
  character: CompanionId;
  reducedMotion: boolean;
}

export interface SceneCallbacks {
  /** Called after each draw so the page can place DOM labels over the canvas. */
  onFrame?: (scene: WorldScene) => void;
  onWalkState?: (state: "idle" | "walking" | "arrived") => void;
}

type Node = { p: Point; edges: number[] };

function buildGraph(): Node[] {
  const nodes: Node[] = [];
  const index = new Map<string, number>();
  const idOf = (p: Point) => {
    const key = `${p.x},${p.y}`;
    let i = index.get(key);
    if (i === undefined) { i = nodes.length; nodes.push({ p, edges: [] }); index.set(key, i); }
    return i;
  };
  for (const path of PATHS) {
    for (let i = 0; i + 1 < path.points.length; i++) {
      const a = idOf(path.points[i]);
      const b = idOf(path.points[i + 1]);
      nodes[a].edges.push(b);
      nodes[b].edges.push(a);
    }
  }
  return nodes;
}

export class WorldScene {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly terrain: HTMLCanvasElement[] = [];
  private readonly sprites = new Map<string, { info: SpriteInfo; image: HTMLImageElement }>();
  private readonly graph = buildGraph();
  private readonly objects: readonly WorldObject[] = worldObjects();
  private readonly drawOrder: WorldObject[];
  private readonly ground: WorldObject[];

  /** World coordinates at the centre of the view, in art pixels. */
  cam: Point = { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 };
  private camTarget: Point | null = null;
  /** Requested CSS pixels per art pixel (an integer); the real value snaps to whole device pixels. */
  zoom = 2;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;
  private devScale = 2;

  player: Point;
  private route: Point[] = [];
  private facing: 1 | -1 = 1;
  private state: AnimationState = "idle";
  private stateSince = 0;
  private celebrateUntil = 0;

  snapshot: SceneSnapshot;
  private dirty = true;
  private raf = 0;
  private last = 0;
  private lastWater = 0;
  private waterPhase = 0;
  private oceanPattern: CanvasPattern | null = null;
  failed = 0;
  disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement, snapshot: SceneSnapshot, start: Point, private readonly callbacks: SceneCallbacks = {}) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas is not available");
    this.ctx = ctx;
    this.snapshot = snapshot;
    this.player = { ...start };
    this.ground = this.objects.filter((o) => GROUND_SPRITES.has(o.sprite)).sort((a, b) => a.y - b.y);
    this.drawOrder = this.objects.filter((o) => !GROUND_SPRITES.has(o.sprite)).sort((a, b) => a.y - b.y);
    for (let phase = 0; phase < 2; phase++) {
      const layer = document.createElement("canvas");
      layer.width = WORLD_SIZE;
      layer.height = WORLD_SIZE;
      paintTerrain(layer, phase);
      this.terrain.push(layer);
    }
  }

  /** Load the sprite manifest and every image. A sprite that fails to load is skipped; the world still draws. */
  async load(): Promise<void> {
    let manifest: Manifest = {};
    try {
      const response = await fetch("/assets/world/manifest.json");
      manifest = (await response.json()) as Manifest;
    } catch {
      this.failed++;
    }
    await Promise.all(
      Object.entries(manifest).map(
        ([name, info]) =>
          new Promise<void>((resolve) => {
            const image = new Image();
            image.onload = () => { this.sprites.set(name, { info, image }); resolve(); };
            image.onerror = () => { this.failed++; resolve(); };
            image.src = info.src;
          }),
      ),
    );
    this.dirty = true;
  }

  /* ----------------------------------------------------------------------------------- viewport and camera */

  resize(cssWidth: number, cssHeight: number, dpr: number) {
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.applyScale();
    this.createOceanPattern();
    this.cam = this.clamp(this.cam);
    this.dirty = true;
  }

  setZoom(zoom: number) {
    this.zoom = Math.max(1, Math.min(4, Math.round(zoom)));
    this.applyScale();
    this.createOceanPattern();
    this.cam = this.clamp(this.cam);
    this.camTarget = this.camTarget && this.clamp(this.camTarget);
    this.dirty = true;
  }

  /** Zoom around a screen point so the world under the pointer stays in place. */
  zoomAt(zoom: number, clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const anchor = this.screenToWorld(clientX, clientY);
    this.zoom = Math.max(1, Math.min(4, Math.round(zoom)));
    this.applyScale();
    this.createOceanPattern();
    this.camTarget = null;
    this.cam = this.clamp({
      x: anchor.x - (clientX - rect.left - this.cssWidth / 2) / this.pixelSize,
      y: anchor.y - (clientY - rect.top - this.cssHeight / 2) / this.pixelSize,
    });
    this.dirty = true;
  }

  private applyScale() {
    this.devScale = Math.max(1, Math.round(this.zoom * this.dpr));
  }

  /** A repeating, hand-authored pixel ripple fills the screen around the explorable island. */
  private createOceanPattern() {
    const tile = document.createElement("canvas");
    const unit = Math.max(1, this.devScale);
    tile.width = 32 * unit;
    tile.height = 32 * unit;
    const tileCtx = tile.getContext("2d");
    if (!tileCtx) return;
    tileCtx.fillStyle = "#347fc3";
    tileCtx.fillRect(0, 0, tile.width, tile.height);
    // Small, deliberate ripple clusters, drawn on the same integer pixel grid as the world.
    const ripples: readonly [number, number, number, string][] = [
      [3, 5, 4, "#4e9cda"], [8, 6, 2, "#73b9e8"], [19, 3, 5, "#2d71b1"],
      [25, 9, 3, "#4e9cda"], [12, 15, 5, "#2d71b1"], [3, 23, 3, "#73b9e8"],
      [20, 21, 4, "#4e9cda"], [27, 28, 2, "#2d71b1"], [10, 29, 3, "#4e9cda"],
    ];
    for (const [x, y, width, color] of ripples) {
      tileCtx.fillStyle = color;
      tileCtx.fillRect(x * unit, y * unit, width * unit, unit);
    }
    this.oceanPattern = this.ctx.createPattern(tile, "repeat");
  }

  /** CSS pixels per art pixel after snapping to whole device pixels. */
  get pixelSize() {
    return this.devScale / this.dpr;
  }

  private clamp(p: Point): Point {
    const halfW = this.cssWidth / this.pixelSize / 2;
    const halfH = this.cssHeight / this.pixelSize / 2;
    const fit = (v: number, half: number) => (half * 2 >= WORLD_SIZE ? WORLD_SIZE / 2 : Math.min(WORLD_SIZE - half, Math.max(half, v)));
    return { x: fit(p.x, halfW), y: fit(p.y, halfH) };
  }

  /** Pan by a screen-space delta in CSS pixels (dragging). */
  pan(dx: number, dy: number) {
    this.camTarget = null;
    this.cam = this.clamp({ x: this.cam.x - dx / this.pixelSize, y: this.cam.y - dy / this.pixelSize });
    this.dirty = true;
  }

  focus(p: Point, immediate = false) {
    const target = this.clamp(p);
    if (immediate || this.snapshot.reducedMotion) { this.cam = target; this.camTarget = null; } else this.camTarget = target;
    this.dirty = true;
  }

  screenToWorld(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: this.cam.x + (clientX - rect.left - this.cssWidth / 2) / this.pixelSize,
      y: this.cam.y + (clientY - rect.top - this.cssHeight / 2) / this.pixelSize,
    };
  }

  worldToCss(p: Point): Point {
    return { x: this.cssWidth / 2 + (p.x - this.cam.x) * this.pixelSize, y: this.cssHeight / 2 + (p.y - this.cam.y) * this.pixelSize };
  }

  hitTest(clientX: number, clientY: number): Region | null {
    const w = this.screenToWorld(clientX, clientY);
    let best: Region | null = null;
    let bestDistance = Infinity;
    for (const region of REGIONS) {
      const d = Math.hypot(w.x - region.anchor.x, w.y - region.anchor.y);
      if (d < region.radius && d < bestDistance) { best = region; bestDistance = d; }
    }
    return best;
  }

  /* ----------------------------------------------------------------------------------- walking */

  private nearestNode(p: Point): number {
    let best = 0;
    let bestDistance = Infinity;
    this.graph.forEach((node, i) => {
      const d = Math.hypot(node.p.x - p.x, node.p.y - p.y);
      if (d < bestDistance) { best = i; bestDistance = d; }
    });
    return best;
  }

  /** Breadth-first search along the trail graph, so the explorer follows paths and crosses rivers only on bridges. */
  private routeBetween(from: Point, to: Point): Point[] {
    const start = this.nearestNode(from);
    const goal = this.nearestNode(to);
    const previous = new Map<number, number>([[start, -1]]);
    const queue = [start];
    while (queue.length) {
      const current = queue.shift()!;
      if (current === goal) break;
      for (const next of this.graph[current].edges) {
        if (!previous.has(next)) { previous.set(next, current); queue.push(next); }
      }
    }
    const nodes: Point[] = [];
    for (let at: number | undefined = goal; at !== undefined && at !== -1; at = previous.get(at)) nodes.unshift(this.graph[at].p);
    return [...nodes, to];
  }

  walkTo(stop: StopId, now = performance.now()) {
    const target = STOPS[stop];
    this.route = this.snapshot.reducedMotion ? [target] : this.routeBetween(this.player, target);
    this.celebrateUntil = 0;
    if (this.snapshot.reducedMotion) { this.player = { ...target }; this.route = []; this.setState("idle", now); this.callbacks.onWalkState?.("arrived"); } else {
      this.setState("walk", now);
      this.callbacks.onWalkState?.("walking");
    }
    this.dirty = true;
  }

  private setState(state: AnimationState, now: number) {
    if (this.state !== state) { this.state = state; this.stateSince = now; }
  }

  /* ----------------------------------------------------------------------------------- loop */

  start() {
    const tick = (now: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(tick);
      if (typeof document !== "undefined" && document.hidden) { this.last = now; return; }
      const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
      this.last = now;
      this.update(dt, now);
      const animating = !this.snapshot.reducedMotion && (this.route.length > 0 || this.state !== "idle" || now - this.lastFrame > 160);
      if (this.dirty || animating) this.draw(now);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private lastFrame = 0;

  markDirty() { this.dirty = true; }

  private update(dt: number, now: number) {
    if (this.camTarget) {
      const k = 1 - Math.exp(-dt * 7);
      this.cam = { x: this.cam.x + (this.camTarget.x - this.cam.x) * k, y: this.cam.y + (this.camTarget.y - this.cam.y) * k };
      if (Math.hypot(this.camTarget.x - this.cam.x, this.camTarget.y - this.cam.y) < 0.25) { this.cam = this.camTarget; this.camTarget = null; }
      this.dirty = true;
    }
    if (this.route.length) {
      let budget = WALK_SPEED * dt;
      while (budget > 0 && this.route.length) {
        const next = this.route[0];
        const dx = next.x - this.player.x;
        const dy = next.y - this.player.y;
        const d = Math.hypot(dx, dy);
        if (dx > 0.5) this.facing = 1; else if (dx < -0.5) this.facing = -1;
        if (d <= budget) { this.player = { ...next }; this.route.shift(); budget -= d; } else {
          this.player = { x: this.player.x + (dx / d) * budget, y: this.player.y + (dy / d) * budget };
          budget = 0;
        }
      }
      if (!this.route.length) {
        this.setState("celebrate", now);
        this.celebrateUntil = now + CELEBRATE_MS;
        this.callbacks.onWalkState?.("arrived");
      }
      this.dirty = true;
    } else if (this.celebrateUntil && now > this.celebrateUntil) {
      this.celebrateUntil = 0;
      this.setState("idle", now);
      this.callbacks.onWalkState?.("idle");
      this.dirty = true;
    }
    if (!this.snapshot.reducedMotion && now - this.lastWater > 520) { this.lastWater = now; this.waterPhase = (this.waterPhase + 1) % 2; this.dirty = true; }
  }

  private currentFrame(now: number): Frame | null {
    const frames = getAnimations(this.snapshot.character)[this.state];
    if (!frames.length) return null;
    if (this.snapshot.reducedMotion) return frames[0];
    const total = frames.reduce((n, f) => n + f.ms, 0);
    let t = now - this.stateSince;
    if (LOOPING[this.state]) t %= total;
    else t = Math.min(t, total - 1);
    for (const f of frames) { if (t < f.ms) return f; t -= f.ms; }
    return frames[frames.length - 1];
  }

  /* ----------------------------------------------------------------------------------- drawing */

  private shadow(x: number, y: number, rx: number, ry: number) {
    const { ctx } = this;
    ctx.fillStyle = "rgba(37, 100, 52, 0.34)";
    for (let j = -ry; j <= ry; j++) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry + 0.5))));
      ctx.fillRect(Math.round(x) - half, Math.round(y) + j, half * 2, 1);
    }
  }

  private drawSprite(o: WorldObject) {
    const sprite = this.sprites.get(o.sprite);
    if (!sprite) return;
    const { info, image } = sprite;
    this.ctx.drawImage(image, Math.round(o.x - info.footX), Math.round(o.y - info.footY));
  }

  private drawExplorer(now: number) {
    const frame = this.currentFrame(now);
    if (!frame) return;
    const { ctx } = this;
    const ox = Math.round(this.player.x) - GRID_W / 2;
    const oy = Math.round(this.player.y) - GRID_H;
    this.shadow(this.player.x, this.player.y - 1, 9, 2);
    for (const [x, y, w, h, color] of frame.pixels) {
      ctx.fillStyle = color;
      const gx = this.facing === 1 ? x : GRID_W - x - w;
      ctx.fillRect(ox + gx, oy + y, w, h);
    }
  }

  private drawMarker(region: Region, now: number) {
    const { ctx } = this;
    const bob = this.snapshot.reducedMotion ? 0 : Math.round(Math.sin(now / 260) * 2);
    const x = region.anchor.x;
    const y = region.anchor.y - 62 + bob;
    // A downward pointer: dark outline, lime body, so the selected landmark can be found at a glance.
    const rows = [
      [-5, 11], [-5, 11], [-4, 9], [-3, 7], [-2, 5], [-1, 3], [0, 1],
    ];
    ctx.fillStyle = "#1e2832";
    rows.forEach(([a, w], j) => ctx.fillRect(x + a - 1, y + j * 2 - 1, w + 2, 4));
    ctx.fillStyle = "#c6f04a";
    rows.forEach(([a, w], j) => ctx.fillRect(x + a, y + j * 2, w, 2));
    ctx.fillStyle = "#e8ffa0";
    ctx.fillRect(x - 4, y, 4, 2);
  }

  draw(now = performance.now()) {
    const { ctx } = this;
    this.dirty = false;
    this.lastFrame = now;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.oceanPattern ?? "#347fc3";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const s = this.devScale;
    const ox = Math.round(this.canvas.width / 2 - this.cam.x * s);
    const oy = Math.round(this.canvas.height / 2 - this.cam.y * s);
    ctx.setTransform(s, 0, 0, s, ox, oy);
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(this.terrain[this.waterPhase % this.terrain.length], 0, 0);
    for (const o of this.ground) this.drawSprite(o);

    // Everything standing in the world, sorted by its foot line so the explorer walks in front of or behind trees.
    for (const o of this.drawOrder) if (o.shadow) {
      const sprite = this.sprites.get(o.sprite);
      if (sprite) this.shadow(o.x, o.y - 1, Math.max(4, Math.min(24, Math.round(sprite.info.w * 0.3))), 2);
    }
    let drewPlayer = false;
    for (const o of this.drawOrder) {
      if (!drewPlayer && o.y > this.player.y) { this.drawExplorer(now); drewPlayer = true; }
      this.drawSprite(o);
    }
    if (!drewPlayer) this.drawExplorer(now);

    const selected = this.snapshot.selected && REGIONS.find((r) => r.id === this.snapshot.selected);
    if (selected) this.drawMarker(selected, now);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.callbacks.onFrame?.(this);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
  }
}

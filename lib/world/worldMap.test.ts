import { describe, expect, it } from "vitest";
import { BRIDGES, FRAME, PATHS, REGIONS, STOPS, WORLD_SIZE, inWater, worldObjects } from "./worldMap";
import type { Point } from "./worldMap";

const GROUND_OVER_WATER = new Set(["bridge", "rocks-water"]);

describe("world map data", () => {
  it("is deterministic: the same objects come out on every build", () => {
    const a = JSON.stringify(worldObjects());
    expect(JSON.stringify(worldObjects())).toBe(a);
    expect(worldObjects().length).toBeGreaterThan(150);
  });

  it("keeps every object inside the frame", () => {
    for (const o of worldObjects()) {
      expect(o.x).toBeGreaterThan(FRAME);
      expect(o.x).toBeLessThan(WORLD_SIZE - FRAME);
      expect(o.y).toBeGreaterThan(FRAME);
      expect(o.y).toBeLessThan(WORLD_SIZE);
    }
  });

  it("keeps trees and buildings out of the water", () => {
    const wet = worldObjects().filter((o) => !GROUND_OVER_WATER.has(o.sprite) && inWater(o.x, o.y, 0));
    expect(wet.map((o) => `${o.sprite}@${o.x},${o.y}`)).toEqual([]);
  });

  it("puts a bridge on every river crossing", () => {
    expect(worldObjects().filter((o) => o.sprite === "bridge")).toHaveLength(BRIDGES.length);
    for (const b of BRIDGES) expect(inWater(b.x, b.y, 0)).toBe(true);
  });

  it("makes every region reachable along the trails", () => {
    const key = (p: Point) => `${p.x},${p.y}`;
    const edges = new Map<string, Set<string>>();
    const link = (a: Point, b: Point) => {
      (edges.get(key(a)) ?? edges.set(key(a), new Set()).get(key(a))!).add(key(b));
      (edges.get(key(b)) ?? edges.set(key(b), new Set()).get(key(b))!).add(key(a));
    };
    for (const path of PATHS) for (let i = 0; i + 1 < path.points.length; i++) link(path.points[i], path.points[i + 1]);
    const nearest = (p: Point) => [...edges.keys()].map((k) => k.split(",").map(Number)).sort((u, v) => Math.hypot(u[0] - p.x, u[1] - p.y) - Math.hypot(v[0] - p.x, v[1] - p.y))[0];
    const start = nearest(STOPS.grove);
    const seen = new Set([`${start[0]},${start[1]}`]);
    const queue = [`${start[0]},${start[1]}`];
    while (queue.length) for (const next of edges.get(queue.shift()!)!) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    for (const region of REGIONS) {
      const n = nearest(STOPS[region.stop]);
      expect(seen.has(`${n[0]},${n[1]}`), region.id).toBe(true);
    }
  });

  it("defines the five learning regions with one available lesson", () => {
    expect(REGIONS.map((r) => r.id)).toEqual(["grove", "caves", "foundry", "training", "frontier"]);
    expect(REGIONS.filter((r) => r.lessonIds.length)).toHaveLength(1);
    expect(REGIONS[0].lessonIds).toEqual(["neuron-basics"]);
  });
});

import { describe, expect, it } from "vitest";
import { ART, GRID_H, GRID_W, validateArt } from "./characterArt";
import { getAnimations, anchorRow } from "./companionAnimations";
import { ANIMATION_STATES } from "./companionTypes";
import type { CompanionId } from "./companionTypes";

const IDS: CompanionId[] = ["rune", "sol"];

describe("character art", () => {
  it.each(IDS)("%s parts are rectangular and use only palette colours", (id) => {
    expect(validateArt(ART[id])).toEqual([]);
  });

  it("keeps the signature details of each design", () => {
    const rune = Object.values(ART.rune.palette);
    expect(rune).toContain("#e4a72f"); // gold visor
    expect(rune).toContain("#d8412a"); // red plume
    expect(ART.rune.heldL).toBeDefined(); // sword
    expect(ART.rune.heldR).toBeDefined(); // shield
    const sol = Object.values(ART.sol.palette);
    expect(sol).toContain("#e8b44a"); // blond hair
    expect(sol).toContain("#6e8c40"); // green tunic
    expect(ART.sol.flame?.length).toBeGreaterThanOrEqual(2); // animated torch
  });
});

describe("animation registry", () => {
  it.each(IDS)("%s has frames for every state, all inside the grid", (id) => {
    const animations = getAnimations(id);
    for (const state of ANIMATION_STATES) {
      const frames = animations[state];
      expect(frames.length, `${id}:${state}`).toBeGreaterThan(0);
      for (const frame of frames) {
        expect(frame.ms).toBeGreaterThan(0);
        expect(frame.pixels.length).toBeGreaterThan(20);
        for (const [x, y, w, h] of frame.pixels) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x + w).toBeLessThanOrEqual(GRID_W);
          expect(y + h).toBeLessThanOrEqual(GRID_H);
        }
      }
    }
  });

  it.each(IDS)("%s poses are genuinely different drawings", (id) => {
    const animations = getAnimations(id);
    const signature = (state: (typeof ANIMATION_STATES)[number]) => JSON.stringify(animations[state].map((f) => f.pixels));
    const seen = new Set(ANIMATION_STATES.map(signature));
    expect(seen.size).toBe(ANIMATION_STATES.length);
    // A step frame differs from standing: the walk cycle moves the legs.
    const walk = animations.walk;
    expect(JSON.stringify(walk[1].pixels)).not.toBe(JSON.stringify(walk[3].pixels));
  });

  it.each(IDS)("%s rests on the ledge at the right row for sitting and hanging", (id) => {
    expect(anchorRow(id, "idle")).toBe(GRID_H);
    expect(anchorRow(id, "hang")).toBeLessThan(8);
    expect(anchorRow(id, "sit")).toBe(ART[id].legsY);
  });
});

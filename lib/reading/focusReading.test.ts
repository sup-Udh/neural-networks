import { describe, expect, it } from "vitest";
import { clampDelaySeconds, growGroup, pickPassage, transition } from "./focusReading";
import type { FocusState } from "./focusReading";

describe("focus state machine", () => {
  it("walks the happy path", () => {
    let s: FocusState = "normal";
    s = transition(s, "enter");
    expect(s).toBe("entering");
    s = transition(s, "settled");
    expect(s).toBe("focused");
    s = transition(s, "exit");
    expect(s).toBe("exiting");
    s = transition(s, "exited");
    expect(s).toBe("normal");
  });
  it("can be cancelled while entering", () => {
    expect(transition("entering", "exit")).toBe("exiting");
  });
  it("ignores re-entry and stale events while exiting", () => {
    expect(transition("exiting", "enter")).toBe("exiting");
    expect(transition("exiting", "settled")).toBe("exiting");
    expect(transition("normal", "settled")).toBe("normal");
    expect(transition("normal", "exit")).toBe("normal");
    expect(transition("focused", "enter")).toBe("focused");
  });
});

describe("delay setting", () => {
  it("stays within 12 to 15 seconds", () => {
    expect(clampDelaySeconds(3)).toBe(12);
    expect(clampDelaySeconds(13)).toBe(13);
    expect(clampDelaySeconds(40)).toBe(15);
    expect(clampDelaySeconds(NaN)).toBe(13);
  });
});

const usable = { top: 72, bottom: 700 };
const para = (top: number, height: number, chars: number, inActiveSection = false) => ({ top, bottom: top + height, chars, inActiveSection });

describe("pickPassage", () => {
  it("prefers a centred passage in the active section", () => {
    const list = [para(80, 120, 300), para(300, 120, 300, true), para(560, 100, 300)];
    expect(pickPassage(list, usable)).toBe(1);
  });
  it("skips passages that are mostly off screen or too short", () => {
    expect(pickPassage([para(650, 200, 300), para(100, 40, 10)], usable)).toBeNull();
  });
  it("returns null when nothing is visible", () => {
    expect(pickPassage([para(900, 100, 300)], usable)).toBeNull();
    expect(pickPassage([], usable)).toBeNull();
  });
});

describe("growGroup", () => {
  it("leaves a long passage alone", () => expect(growGroup([500, 100], 0)).toEqual([0, 0]));
  it("adds following passages for short ones, up to three", () => {
    expect(growGroup([80, 90, 70, 60], 0)).toEqual([0, 2]);
  });
  it("reaches backwards at the end of the run", () => {
    expect(growGroup([120, 100], 1)).toEqual([0, 1]);
  });
});

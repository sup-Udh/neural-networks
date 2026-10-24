export type CompanionId = "rune" | "sol";
export type Pixel = readonly [x: number, y: number, width: number, height: number, color: string];

export type AnimationState = "idle" | "walk" | "jump" | "inspect" | "hang" | "sit" | "work" | "celebrate";
export const ANIMATION_STATES: readonly AnimationState[] = ["idle", "walk", "jump", "inspect", "hang", "sit", "work", "celebrate"];

/** Rendered sprite height in CSS px. The rig is 24 rows tall, so 24 is an exact 1x and 48 an exact 2x. */
export const COMPANION_SIZES = [16, 24, 36, 48] as const;
export type CompanionSize = (typeof COMPANION_SIZES)[number];

/** How a section lets the companion rest next to it. */
export type PerchMode = "stand" | "hang" | "sit" | "work";

export type Frame = { pixels: Pixel[]; ms: number };

export interface PixelCompanionHandle {
  /** Play a state in place (development and manual triggers). */
  play: (state: AnimationState) => void;
  celebrate: () => void;
  inspect: (element: Element) => void;
}

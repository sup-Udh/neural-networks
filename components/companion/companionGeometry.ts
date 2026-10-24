/*
 * DOM measurements used to put the companion on real text lines.
 * Every coordinate returned is relative to the stage element (the companion's positioned ancestor).
 */

export interface TextLine {
  left: number;
  right: number;
  /** Baseline-ish y where the companion's feet rest. */
  ledge: number;
}

const BLOCKS = "p, li, h2, td, th, caption, .doc-code-bar, .doc-equation";

/** The text line closest to stage-relative `y`, or null when no text is nearby. */
export function lineNear(stage: HTMLElement, content: Element, y: number): TextLine | null {
  const sr = stage.getBoundingClientRect();
  const vy = sr.top + y;
  const range = document.createRange();
  let bestBlock: Element | null = null;
  let bestRect: DOMRect | null = null;
  let bestDistance = Infinity;
  for (const block of content.querySelectorAll(BLOCKS)) {
    const br = block.getBoundingClientRect();
    if (vy < br.top - 40 || vy > br.bottom + 40) continue;
    range.selectNodeContents(block);
    for (const r of range.getClientRects()) {
      if (r.width < 4 || r.height < 4) continue;
      const d = Math.abs((r.top + r.bottom) / 2 - vy);
      if (d < bestDistance) {
        bestDistance = d;
        bestBlock = block;
        bestRect = r;
      }
    }
  }
  if (!bestBlock || !bestRect) return null;
  // Merge the fragments that sit on the same visual line (inline marks split a line into several rects).
  range.selectNodeContents(bestBlock);
  let left = bestRect.left;
  let right = bestRect.right;
  for (const r of range.getClientRects()) {
    if (r.width >= 4 && Math.abs(r.bottom - bestRect.bottom) < 4) {
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
    }
  }
  return { left: left - sr.left, right: right - sr.left, ledge: Math.round(bestRect.bottom - sr.top - 3) };
}

/** The y of the line the companion rests beside for a section: the heading rule, or a code block top edge. */
export function perchLedge(stage: HTMLElement, anchor: HTMLElement): number {
  const sr = stage.getBoundingClientRect();
  const ar = anchor.getBoundingClientRect();
  return Math.round((anchor.dataset.companionEdge === "top" ? ar.top : ar.bottom) - sr.top);
}

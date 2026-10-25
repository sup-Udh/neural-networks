import { ART } from "./characterArt";
import type { Rows } from "./characterArt";
import type { CompanionId, Pixel } from "./companionTypes";

/** Rows of ASCII art to merged rectangles (runs along each row, same colours stacked vertically). */
export function rowsToPixels(rows: Rows, palette: Record<string, string>): Pixel[] {
  const rects: Pixel[] = [];
  const open = new Map<string, number>();
  const width = rows[0]?.length ?? 0;
  for (let y = 0; y <= rows.length; y++) {
    const runs = new Set<string>();
    if (y < rows.length) {
      let x = 0;
      while (x < width) {
        const ch = rows[y][x];
        if (ch === ".") { x++; continue; }
        let end = x;
        while (end + 1 < width && rows[y][end + 1] === ch) end++;
        runs.add(`${x}:${end - x + 1}:${ch}`);
        x = end + 1;
      }
    }
    for (const [key, startY] of [...open]) {
      if (!runs.has(key)) {
        const [x, w, ch] = key.split(":");
        rects.push([Number(x), startY, Number(w), y - startY, palette[ch]]);
        open.delete(key);
      }
    }
    for (const key of runs) if (!open.has(key)) open.set(key, y);
  }
  return rects;
}

/** Head-and-helmet (or hair) crop of the canonical design, for small badges and the dock button. */
export const portraits: Record<CompanionId, { pixels: Pixel[]; width: number; height: number }> = {
  rune: { pixels: rowsToPixels(ART.rune.head, ART.rune.palette), width: ART.rune.head[0].length, height: ART.rune.head.length },
  sol: { pixels: rowsToPixels(ART.sol.head, ART.sol.palette), width: ART.sol.head[0].length, height: ART.sol.head.length },
};

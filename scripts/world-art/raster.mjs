// Tiny RGBA raster used to hand-paint the world sprites. No smoothing anywhere: every call writes whole pixels.

export const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Deterministic pseudo random numbers so regenerated art never changes between runs. */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return (s % 100000) / 100000;
  };
}

export class Raster {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Array(w * h).fill(null);
  }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.data[y * this.w + x]; }
  px(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = c; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c); }
  /** Filled ellipse. `fn(x, y, dx, dy)` may return a colour per pixel (for shading) or null to skip. */
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) {
          const colour = typeof c === "function" ? c(x, y, dx, dy) : c;
          if (colour) this.px(x, y, colour);
        }
      }
    }
  }
  poly(points, c) {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        const yy = y + 0.5;
        if ((y1 <= yy && y2 > yy) || (y2 <= yy && y1 > yy)) xs.push(x1 + ((yy - y1) * (x2 - x1)) / (y2 - y1));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) {
          const colour = typeof c === "function" ? c(x, y) : c;
          if (colour) this.px(x, y, colour);
        }
      }
    }
  }
  line(x1, y1, x2, y2, c) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
    for (let i = 0; i <= steps; i++) this.px(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps, c);
  }
  /** Copy another raster on top (null pixels are transparent). */
  blit(src, ox, oy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.get(x, y); if (c) this.px(ox + x, oy + y, c); }
  }
  /** One-pixel outline around everything painted so far (4-neighbour keeps the line crisp). */
  outline(c, { diagonal = false } = {}) {
    const marks = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        const near = this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)
          || (diagonal && (this.get(x - 1, y - 1) || this.get(x + 1, y - 1) || this.get(x - 1, y + 1) || this.get(x + 1, y + 1)));
        if (near) marks.push([x, y]);
      }
    }
    for (const [x, y] of marks) this.px(x, y, c);
  }
  /** Drop the transparent border, returning the offset so foot positions can follow. */
  trim() {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.get(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 < 0) return { raster: this, ox: 0, oy: 0 };
    const out = new Raster(x1 - x0 + 1, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.data[(y - y0) * out.w + (x - x0)] = this.get(x, y);
    return { raster: out, ox: x0, oy: y0 };
  }
  toRgba() {
    const buf = Buffer.alloc(this.w * this.h * 4);
    this.data.forEach((c, i) => {
      if (!c) return;
      const [r, g, b] = hexRgb(c);
      buf[i * 4] = r; buf[i * 4 + 1] = g; buf[i * 4 + 2] = b; buf[i * 4 + 3] = 255;
    });
    return buf;
  }
}

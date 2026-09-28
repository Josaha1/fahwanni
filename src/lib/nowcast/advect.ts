import type { Levels } from "./intensity";

/**
 * Semi-Lagrangian (backward) advection: the value at p after τ minutes is the source value at
 * p − v·τ. Nearest-neighbour keeps the discrete levels intact; pixels arriving from outside the
 * grid are dry.
 */
export function advect(levels: Levels, w: number, h: number, vxPerMin: number, vyPerMin: number, tauMin: number): Levels {
  const out = new Uint8Array(w * h);
  const dx = vxPerMin * tauMin, dy = vyPerMin * tauMin;
  for (let y = 0; y < h; y++) {
    const sy = Math.round(y - dy);
    if (sy < 0 || sy >= h) continue;
    for (let x = 0; x < w; x++) {
      const sx = Math.round(x - dx);
      if (sx >= 0 && sx < w) out[y * w + x] = levels[sy * w + sx];
    }
  }
  return out;
}

/**
 * Box blur on levels (rounded mean over a square window); spreads the forecast as lead time
 * grows so uncertainty reads as softer edges.
 */
export function boxBlur(levels: Levels, w: number, h: number, radius: number): Levels {
  if (radius <= 0) return levels.slice();
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, n = 0;
      for (let yy = Math.max(0, y - radius); yy <= Math.min(h - 1, y + radius); yy++) {
        for (let xx = Math.max(0, x - radius); xx <= Math.min(w - 1, x + radius); xx++) { sum += levels[yy * w + xx]; n++; }
      }
      out[y * w + x] = Math.round(sum / n);
    }
  }
  return out;
}

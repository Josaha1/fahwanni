import type { Levels } from "./intensity";

export interface Motion {
  /** Pixels per frame interval (x east, y south). */
  vx: number;
  vy: number;
  /** Blocks that had enough rain to vote. */
  blocks: number;
}

/** Max-pooling downsample: a coarse cell is as rainy as its rainiest pixel. */
export function downsample(levels: Levels, w: number, h: number, factor: number): { levels: Levels; w: number; h: number } {
  const ow = Math.floor(w / factor), oh = Math.floor(h / factor);
  const out = new Uint8Array(ow * oh);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      let m = 0;
      for (let yy = 0; yy < factor; yy++) for (let xx = 0; xx < factor; xx++) m = Math.max(m, levels[(y * factor + yy) * w + x * factor + xx]);
      out[y * ow + x] = m;
    }
  }
  return { levels: out, w: ow, h: oh };
}

function sad(prev: Levels, curr: Levels, w: number, h: number, bx: number, by: number, block: number, dx: number, dy: number): number {
  // Compare prev at p with curr at p + d: how well does "prev moved by d" explain curr?
  let s = 0;
  for (let y = by; y < by + block; y++) {
    const cy = y + dy;
    for (let x = bx; x < bx + block; x++) {
      const cx = x + dx;
      const c = cy >= 0 && cy < h && cx >= 0 && cx < w ? curr[cy * w + cx] : 0;
      s += Math.abs(prev[y * w + x] - c);
    }
  }
  return s;
}

/** Parabolic sub-pixel offset from three costs around a minimum. */
function subPixel(left: number, mid: number, right: number): number {
  const denom = left - 2 * mid + right;
  return denom > 0 ? Math.max(-0.5, Math.min(0.5, (left - right) / (2 * denom))) : 0;
}

function weightedMedian(values: number[], weights: number[]): number {
  const order = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (const i of order) { acc += weights[i]; if (acc >= total / 2) return values[i]; }
  return 0;
}

/**
 * One global motion vector between two frames: block matching (SAD, ±search px) on blocks
 * with enough rain, parabolic sub-pixel refinement, then a rain-weighted median of the block
 * vectors (robust to a few blocks locking onto the wrong cell).
 */
export function estimateMotion(prev: Levels, curr: Levels, w: number, h: number,
  opts: { block?: number; search?: number; minRainFraction?: number } = {}): Motion {
  const block = opts.block ?? 32, search = opts.search ?? 6, minRain = opts.minRainFraction ?? 0.02;
  const vxs: number[] = [], vys: number[] = [], weights: number[] = [];
  for (let by = 0; by + block <= h; by += block) {
    for (let bx = 0; bx + block <= w; bx += block) {
      let rain = 0;
      for (let y = by; y < by + block; y++) for (let x = bx; x < bx + block; x++) if (prev[y * w + x] > 0) rain++;
      if (rain / (block * block) < minRain) continue;
      let best = Infinity, bdx = 0, bdy = 0;
      const cost = new Map<string, number>();
      for (let dy = -search; dy <= search; dy++) {
        for (let dx = -search; dx <= search; dx++) {
          const c = sad(prev, curr, w, h, bx, by, block, dx, dy);
          cost.set(`${dx},${dy}`, c);
          // Prefer the smallest shift on ties so a static field gives (0,0).
          if (c < best || (c === best && Math.hypot(dx, dy) < Math.hypot(bdx, bdy))) { best = c; bdx = dx; bdy = dy; }
        }
      }
      const at = (dx: number, dy: number) => cost.get(`${dx},${dy}`) ?? best;
      const fx = Math.abs(bdx) < search ? subPixel(at(bdx - 1, bdy), best, at(bdx + 1, bdy)) : 0;
      const fy = Math.abs(bdy) < search ? subPixel(at(bdx, bdy - 1), best, at(bdx, bdy + 1)) : 0;
      vxs.push(bdx + fx); vys.push(bdy + fy); weights.push(rain);
    }
  }
  if (weights.length === 0) return { vx: 0, vy: 0, blocks: 0 };
  return { vx: weightedMedian(vxs, weights), vy: weightedMedian(vys, weights), blocks: weights.length };
}

/** Converts a per-frame vector to per-minute using the real time between the frames. */
export function motionPerMinute(motion: Motion, dtMinutes: number): { vx: number; vy: number } {
  return dtMinutes > 0 ? { vx: motion.vx / dtMinutes, vy: motion.vy / dtMinutes } : { vx: 0, vy: 0 };
}

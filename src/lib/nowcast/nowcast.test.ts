import { describe, expect, it } from "vitest";
import { advect, boxBlur } from "./advect";
import { imageToLevels, levelsToRgba, levelToRgba, rainFraction, rgbaToLevel } from "./intensity";
import { downsample, estimateMotion, motionPerMinute } from "./motion";
import { scoreBinary } from "./score";
import { classifyPixel } from "../radar/summary";

const W = 128, H = 128;

/** A graded blob (level 4 core → 1 edge) centred at (cx, cy). */
function blob(cx: number, cy: number, r = 12, w = W, h = H): Uint8Array {
  const g = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= r) g[y * w + x] = Math.max(1, 4 - Math.floor((d / r) * 4));
  }
  return g;
}

function centroid(g: Uint8Array, w = W): { x: number; y: number } {
  let sx = 0, sy = 0, n = 0;
  g.forEach((v, i) => { if (v) { sx += i % w; sy += Math.floor(i / w); n++; } });
  return { x: sx / n, y: sy / n };
}

describe("intensity", () => {
  it("agrees with classifyPixel on rain / heavy", () => {
    const samples: [number, number, number, number][] = [[0, 0, 0, 0], [80, 150, 240, 30], [156, 219, 255, 255], [51, 131, 219, 255], [255, 225, 100, 255], [232, 71, 63, 255]];
    for (const px of samples) {
      const level = rgbaToLevel(...px);
      const { rain, heavy } = classifyPixel(...px);
      expect(level > 0).toBe(rain);
      expect(level >= 3).toBe(heavy);
    }
  });

  it("orders blues and warm colours by intensity", () => {
    expect(rgbaToLevel(156, 219, 255, 255)).toBe(1);
    expect(rgbaToLevel(51, 131, 219, 255)).toBe(2);
    expect(rgbaToLevel(255, 225, 100, 255)).toBe(3);
    expect(rgbaToLevel(232, 71, 63, 255)).toBe(4);
  });

  it("round-trips an image and paints levels", () => {
    const data = new Uint8ClampedArray([0, 0, 0, 0, ...levelToRgba(4)]);
    const levels = imageToLevels({ data, width: 2, height: 1 });
    expect([...levels]).toEqual([0, 4]);
    expect([...levelsToRgba(levels, 150)]).toEqual([0, 0, 0, 0, 0xe8, 0x47, 0x3f, 150]);
    expect(rainFraction(levels)).toBe(0.5);
  });
});

describe("estimateMotion", () => {
  it("recovers a (3, −2) px shift within ±0.5", () => {
    const m = estimateMotion(blob(50, 60), blob(53, 58), W, H);
    expect(m.blocks).toBeGreaterThan(0);
    expect(Math.abs(m.vx - 3)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(m.vy + 2)).toBeLessThanOrEqual(0.5);
  });

  it("returns zero for a static field and for no rain", () => {
    const g = blob(64, 64);
    const m = estimateMotion(g, g, W, H);
    // Sub-pixel refinement can leave a hair of bias from asymmetric block edges (~0.01 px).
    expect(Math.abs(m.vx)).toBeLessThan(0.05);
    expect(Math.abs(m.vy)).toBeLessThan(0.05);
    expect(estimateMotion(new Uint8Array(W * H), new Uint8Array(W * H), W, H)).toEqual({ vx: 0, vy: 0, blocks: 0 });
  });

  it("works on a downsampled grid", () => {
    const a = downsample(blob(40, 40, 20, 256, 256), 256, 256, 2);
    const b = downsample(blob(48, 36, 20, 256, 256), 256, 256, 2);
    expect(a.w).toBe(128);
    const m = estimateMotion(a.levels, b.levels, a.w, a.h);
    expect(Math.abs(m.vx - 4)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(m.vy + 2)).toBeLessThanOrEqual(0.5);
  });

  it("converts to per-minute with the real frame gap", () => {
    expect(motionPerMinute({ vx: 3, vy: -2, blocks: 1 }, 10)).toEqual({ vx: 0.3, vy: -0.2 });
    expect(motionPerMinute({ vx: 3, vy: -2, blocks: 1 }, 0)).toEqual({ vx: 0, vy: 0 });
  });
});

describe("advect", () => {
  it("moves the field by v·τ and leaves the entering edge dry", () => {
    const moved = advect(blob(50, 60), W, H, 0.3, -0.2, 30); // +9, −6 px
    const c = centroid(moved);
    expect(c.x).toBeCloseTo(59, 0);
    expect(c.y).toBeCloseTo(54, 0);
  });

  it("drops rain that leaves the grid", () => {
    expect(rainFraction(advect(blob(120, 64, 6), W, H, 1, 0, 30))).toBe(0);
  });
});

describe("boxBlur", () => {
  it("softens edges but keeps a copy at radius 0", () => {
    const g = blob(64, 64, 6);
    expect([...boxBlur(g, W, H, 0)]).toEqual([...g]);
    expect(boxBlur(g, W, H, 2)[64 * W + 64]).toBeLessThan(g[64 * W + 64]);
  });
});

describe("scoreBinary", () => {
  it("scores a hand-made case", () => {
    const f = new Uint8Array([1, 1, 0, 0, 2]);
    const o = new Uint8Array([1, 0, 1, 0, 3]);
    expect(scoreBinary(f, o)).toEqual({ hits: 2, misses: 1, falseAlarms: 1, pod: 2 / 3, far: 1 / 3, csi: 0.5 });
  });

  it("is perfect for identical grids and 0 for empty ones", () => {
    const g = blob(64, 64);
    expect(scoreBinary(g, g).csi).toBe(1);
    expect(scoreBinary(new Uint8Array(4), new Uint8Array(4))).toMatchObject({ pod: 0, far: 0, csi: 0 });
  });
});

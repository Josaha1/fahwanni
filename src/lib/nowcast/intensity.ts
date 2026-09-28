/**
 * Radar pixels ↔ intensity levels for the nowcast. Levels: 0 dry, 1 light, 2 moderate,
 * 3 heavy (yellow), 4 very heavy (orange/red). Classification follows RainViewer colour
 * scheme 2 ("Universal Blue") and agrees with classifyPixel in ../radar/summary.ts
 * (rain = alpha ≥ 64; heavy = r > 200 && b < 120).
 */
export type Levels = Uint8Array;

export function rgbaToLevel(r: number, g: number, b: number, a: number): number {
  if (a < 64) return 0;
  if (r > 200 && b < 120) return g < 150 ? 4 : 3;
  // Blues: light rain is pale/cyan, moderate is the deeper blue.
  return r + g > 260 ? 1 : 2;
}

export function imageToLevels(image: { data: ArrayLike<number>; width: number; height: number }): Levels {
  const out = new Uint8Array(image.width * image.height);
  for (let i = 0; i < out.length; i++) {
    const p = i * 4;
    out[i] = rgbaToLevel(image.data[p], image.data[p + 1], image.data[p + 2], image.data[p + 3]);
  }
  return out;
}

/** Legend colours used on the map (radar panel gradient). */
const PALETTE: [number, number, number][] = [
  [0, 0, 0],
  [0x9c, 0xdb, 0xff],
  [0x33, 0x83, 0xdb],
  [0xff, 0xe1, 0x64],
  [0xe8, 0x47, 0x3f],
];

export function levelToRgba(level: number, alpha = 200): [number, number, number, number] {
  if (level <= 0) return [0, 0, 0, 0];
  const [r, g, b] = PALETTE[Math.min(4, level)];
  return [r, g, b, alpha];
}

/** Paints levels into an RGBA buffer (e.g. ImageData.data). */
export function levelsToRgba(levels: Levels, alpha = 200): Uint8ClampedArray {
  const out = new Uint8ClampedArray(levels.length * 4);
  for (let i = 0; i < levels.length; i++) out.set(levelToRgba(levels[i], alpha), i * 4);
  return out;
}

export function rainFraction(levels: Levels, threshold = 1): number {
  let n = 0;
  for (let i = 0; i < levels.length; i++) if (levels[i] >= threshold) n++;
  return levels.length ? n / levels.length : 0;
}

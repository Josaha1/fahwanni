import type { BaseTheme } from "./base-style";

/** Mercator tile bounds of the DEM used by scripts/map/build-relief.mjs. */
export const RELIEF_TILES = { z: 6, x0: 48, x1: 51, y0: 27, y1: 31 } as const;
export const RELIEF_FADE_START = 7;
export const RELIEF_FADE_END = 9;

export function tileLon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

export function tileLat(y: number, z: number): number {
  return (Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / 2 ** z)) * 180) / Math.PI;
}

export function reliefUrl(theme: BaseTheme): string {
  return `/map/relief-${theme}.webp`;
}

/** ImageSource corners: top-left, top-right, bottom-right, bottom-left. */
export function reliefCoordinates(): [[number, number], [number, number], [number, number], [number, number]] {
  const { z, x0, x1, y0, y1 } = RELIEF_TILES;
  const west = tileLon(x0, z), east = tileLon(x1 + 1, z);
  const north = tileLat(y0, z), south = tileLat(y1 + 1, z);
  return [[west, north], [east, north], [east, south], [west, south]];
}

/** Raster opacity fades away as detailed base tiles take over. */
export function reliefOpacity(theme: BaseTheme): ["interpolate", ["linear"], ["zoom"], number, number, number, number] {
  return ["interpolate", ["linear"], ["zoom"], RELIEF_FADE_START, theme === "light" ? 0.9 : 0.85, RELIEF_FADE_END, 0];
}

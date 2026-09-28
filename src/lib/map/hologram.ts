/**
 * Placement of the Blender hologram terrain plate (public/map/hologram-terrain.webp), built by
 * scripts/map/build-hologram.mjs from Terrarium tiles z6 x48–51, y27–31. The image is in Web
 * Mercator tile space, so its four corners are the tile-range bounds.
 */
export const HOLOGRAM_TILES = { z: 6, x0: 48, x1: 51, y0: 27, y1: 31 } as const;
export const HOLOGRAM_URL = "/map/hologram-terrain.webp";
/** Fully visible up to this zoom, faded out by HOLOGRAM_FADE_END (detail tiles take over). */
export const HOLOGRAM_FADE_START = 7;
export const HOLOGRAM_FADE_END = 9;

export function tileLon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

export function tileLat(y: number, z: number): number {
  return (Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / 2 ** z)) * 180) / Math.PI;
}

/** ImageSource corners: top-left, top-right, bottom-right, bottom-left. */
export function hologramCoordinates(): [[number, number], [number, number], [number, number], [number, number]] {
  const { z, x0, x1, y0, y1 } = HOLOGRAM_TILES;
  const west = tileLon(x0, z), east = tileLon(x1 + 1, z);
  const north = tileLat(y0, z), south = tileLat(y1 + 1, z);
  return [[west, north], [east, north], [east, south], [west, south]];
}

/** MapLibre raster-opacity expression: 0.85 until the fade starts, 0 at the end. */
export function hologramOpacity(): unknown[] {
  return ["interpolate", ["linear"], ["zoom"], HOLOGRAM_FADE_START, 0.85, HOLOGRAM_FADE_END, 0];
}

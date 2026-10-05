export const TERRAIN_SOURCE = "terrain-dem";
export const HILLSHADE_SOURCE = "hillshade-dem";
export const HILLSHADE_LAYER = "terrain-hillshade";

export const terrainSource = {
  type: "raster-dem" as const,
  tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
  encoding: "terrarium" as const,
  tileSize: 256,
  maxzoom: 12,
};

export const TERRAIN_ATTRIBUTION =
  '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener noreferrer">Terrain: AWS Terrain Tiles / Mapzen</a>';

/**
 * 3D terrain drapes a large texture; MapLibre has known memory crashes on low-memory
 * Android WebViews, so it is only offered on devices reporting ≥ 4 GB (or not reporting).
 */
export function terrainAvailable(deviceMemory?: number): boolean {
  return deviceMemory === undefined || deviceMemory >= 4;
}

/** Camera for entering/leaving 3D; reduced motion jumps instead of animating. */
export function terrainCamera(on: boolean, reducedMotion: boolean): { pitch: number; duration: number } {
  return { pitch: on ? 55 : 0, duration: reducedMotion ? 0 : 800 };
}

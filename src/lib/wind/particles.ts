import { windColor } from "../map/palette";
import { sampleAt, type WindGrid } from "./grid";

export interface Particle {
  lon: number;
  lat: number;
  age: number;
}

export interface MotionEnv {
  reducedMotion: boolean;
  saveData: boolean;
  /** navigator.deviceMemory in GB; undefined where the browser does not expose it. */
  deviceMemory?: number;
}

export const MAX_AGE = 90;
/** Degrees moved per frame for 1 m/s — tuned so a 5 m/s breeze drifts visibly but calmly at zoom 6. */
const DEG_PER_MS = 0.0028;

/** Decides whether particles may animate and how many a device can afford. */
export function windMotion(env: MotionEnv): { animate: boolean; count: number } {
  if (env.reducedMotion || env.saveData) return { animate: false, count: 0 };
  return { animate: true, count: env.deviceMemory !== undefined && env.deviceMemory < 4 ? 600 : 1200 };
}

export type Bounds = readonly [west: number, south: number, east: number, north: number];

/** The part of the viewport covered by the grid; the whole grid when they do not overlap. */
export function spawnArea(grid: WindGrid, view?: Bounds): Bounds {
  const [gw, gs, ge, gn] = grid.bbox;
  if (!view) return grid.bbox;
  const area: Bounds = [Math.max(gw, view[0]), Math.max(gs, view[1]), Math.min(ge, view[2]), Math.min(gn, view[3])];
  return area[0] < area[2] && area[1] < area[3] ? area : grid.bbox;
}

/** Spawns within `area` so particle density follows the zoom level. */
export function spawnParticle(grid: WindGrid, random: () => number = Math.random, area: Bounds = grid.bbox): Particle {
  const [west, south, east, north] = area;
  return {
    lon: west + random() * (east - west),
    lat: south + random() * (north - south),
    // Staggered ages keep particles from all respawning on the same frame.
    age: Math.floor(random() * MAX_AGE),
  };
}

/** Advances one particle by one frame; respawns it when it ages out or leaves the grid. */
export function stepParticle(
  p: Particle, grid: WindGrid, hourIndex: number,
  random: () => number = Math.random, area: Bounds = grid.bbox, zoom = 6,
): Particle {
  const wind = p.age < MAX_AGE ? sampleAt(grid, hourIndex, p.lon, p.lat) : undefined;
  if (!wind) return { ...spawnParticle(grid, random, area), age: 0 };
  const cosLat = Math.max(Math.cos((p.lat * Math.PI) / 180), 0.2);
  // Same on-screen drift at every zoom: halve the step per zoom level in.
  const step = DEG_PER_MS * 2 ** (6 - zoom);
  return {
    lon: p.lon + (wind.u * step) / cosLat,
    lat: p.lat + wind.v * step,
    age: p.age + 1,
  };
}

/** Index of the latest grid hour at or before now (first hour if now is earlier). */
export function currentHourIndex(hours: string[], nowIso: string): number {
  const now = Date.parse(nowIso);
  let index = 0;
  hours.forEach((hour, i) => { if (Date.parse(hour) <= now) index = i; });
  return index;
}

/** Wind colour follows the shared map palette; speed is in m/s. */
export function speedColor(speed: number): string {
  return windColor(speed);
}

import { MIN_PROB, precipLevel } from "../precip/render";
import type { WindGrid } from "../wind/grid";

export function sampleGrid(grid: Pick<WindGrid, "bbox" | "nx" | "ny">, values: number[], lon: number, lat: number): number | null {
  const [west, south, east, north] = grid.bbox;
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < west || lon > east || lat < south || lat > north || grid.nx < 2 || grid.ny < 2) return null;
  const x = (lon - west) / (east - west) * (grid.nx - 1);
  const y = (north - lat) / (north - south) * (grid.ny - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, grid.nx - 1), y1 = Math.min(y0 + 1, grid.ny - 1);
  const corners = [values[y0 * grid.nx + x0], values[y0 * grid.nx + x1], values[y1 * grid.nx + x0], values[y1 * grid.nx + x1]];
  if (corners.some((value) => !Number.isFinite(value))) return null;
  const fx = x - x0, fy = y - y0;
  return corners[0] * (1 - fx) * (1 - fy) + corners[1] * fx * (1 - fy) + corners[2] * (1 - fx) * fy + corners[3] * fx * fy;
}

export function windAt(grid: WindGrid, hourIndex: number, lon: number, lat: number): { speedKmh: number; fromDeg: number } | null {
  const us = grid.u[hourIndex], vs = grid.v[hourIndex];
  if (!us || !vs) return null;
  const u = sampleGrid(grid, us, lon, lat), v = sampleGrid(grid, vs, lon, lat);
  if (u === null || v === null) return null;
  return { speedKmh: Math.round(Math.hypot(u, v) * 3.6), fromDeg: Math.round((Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360) % 360 };
}

export function modelRainAt(grid: WindGrid, lon: number, lat: number, hours = 3): { level: number; hourIndex: number } | null {
  if (!grid.precip?.length || !grid.prob?.length) return null;
  let best: { level: number; hourIndex: number } | null = null;
  for (let hourIndex = 0; hourIndex < Math.min(hours, grid.precip.length, grid.prob.length); hourIndex++) {
    const mm = sampleGrid(grid, grid.precip[hourIndex], lon, lat);
    const prob = sampleGrid(grid, grid.prob[hourIndex], lon, lat);
    if (mm === null || prob === null) return null;
    const level = prob < MIN_PROB ? 0 : precipLevel(mm);
    if (!best || level > best.level) best = { level, hourIndex };
  }
  return best;
}

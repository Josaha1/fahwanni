import { sampleSeries, type HourlySeries } from "../timeline/store";
import { lerpGrid } from "../timeline/time";
import type { WindGrid } from "./grid";

export interface WindField {
  bbox: readonly [number, number, number, number];
  nx: number;
  ny: number;
  u: Float32Array;
  v: Float32Array;
}

type Geometry = Pick<WindField, "bbox" | "nx" | "ny">;

/** Samples both components at the same model time, optionally reusing the output arrays. */
export function windFieldAt(series: HourlySeries | null, t: number, geo: Geometry, out?: WindField): WindField | null {
  if (!series) return null;
  const u = sampleSeries(series, "u", t);
  const v = sampleSeries(series, "v", t);
  const size = geo.nx * geo.ny;
  if (!u || !v || !Number.isInteger(size) || size < 1 ||
    [u.a, u.b, v.a, v.b].some((values) => values.length !== size)) return null;
  const target = out && out.u.length === size && out.v.length === size ? out : {
    bbox: geo.bbox, nx: geo.nx, ny: geo.ny, u: new Float32Array(size), v: new Float32Array(size),
  };
  target.bbox = geo.bbox;
  target.nx = geo.nx;
  target.ny = geo.ny;
  lerpGrid(u.a, u.b, u.f, target.u);
  lerpGrid(v.a, v.b, v.f, target.v);
  return target;
}

/** Legacy grid fallback for times that are not yet in the loaded day chunks. */
export function fieldFromGrid(grid: WindGrid, hourIndex: number): WindField | null {
  const u = grid.u[hourIndex], v = grid.v[hourIndex];
  if (!u || !v || u.length !== grid.nx * grid.ny || v.length !== u.length) return null;
  return { bbox: grid.bbox, nx: grid.nx, ny: grid.ny, u: Float32Array.from(u), v: Float32Array.from(v) };
}

/** Bilinear sample of the interpolated components; undefined outside the field. */
export function sampleField(field: WindField, lon: number, lat: number): { u: number; v: number } | undefined {
  const [west, south, east, north] = field.bbox;
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < west || lon > east || lat < south || lat > north ||
    field.nx < 2 || field.ny < 2) return undefined;
  const x = ((lon - west) / (east - west)) * (field.nx - 1);
  const y = ((north - lat) / (north - south)) * (field.ny - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, field.nx - 1), y1 = Math.min(y0 + 1, field.ny - 1);
  const fx = x - x0, fy = y - y0;
  const at = (values: Float32Array, cx: number, cy: number) => values[cy * field.nx + cx];
  const sample = (values: Float32Array) =>
    at(values, x0, y0) * (1 - fx) * (1 - fy) + at(values, x1, y0) * fx * (1 - fy) +
    at(values, x0, y1) * (1 - fx) * fy + at(values, x1, y1) * fx * fy;
  const u = sample(field.u), v = sample(field.v);
  return Number.isFinite(u) && Number.isFinite(v) ? { u, v } : undefined;
}

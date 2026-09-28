import { levelToRgba } from "../nowcast/intensity";
import type { WindGrid } from "../wind/grid";

export type Corners = [[number, number], [number, number], [number, number], [number, number]];

export interface PrecipImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** MapLibre ImageSource corners: top-left, top-right, bottom-right, bottom-left. */
  coordinates: Corners;
}

/** Web-Mercator y (unitless) for a latitude; larger = further north. */
export function latToMercY(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

export function mercYToLat(y: number): number {
  return ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
}

/** Same bins as the radar legend: <0.1 dry, then light / moderate / heavy / very heavy. */
export function precipLevel(mm: number): number {
  if (mm < 0.1) return 0;
  if (mm < 1) return 1;
  if (mm < 4) return 2;
  if (mm < 10) return 3;
  return 4;
}

/** Probability fades weak signals so the model layer reads as an outlook, not radar. */
export function precipAlpha(probPct: number): number {
  return Math.round(Math.min(0.8, Math.max(0.25, probPct / 100)) * 255);
}

/**
 * Rasterises one model-rain hour. The image is placed on a Mercator map by its corners, so
 * rows are spaced evenly in Mercator y (not latitude); values are bilinear between grid points.
 */
export function renderPrecipImage(grid: WindGrid, hourIndex: number, width = 256, height = 256): PrecipImage | null {
  const mm = grid.precip?.[hourIndex];
  const pr = grid.prob?.[hourIndex];
  if (!mm || !pr) return null;
  const [west, south, east, north] = grid.bbox;
  const { nx, ny } = grid;
  const yTop = latToMercY(north), yBottom = latToMercY(south);
  const data = new Uint8ClampedArray(width * height * 4);

  for (let row = 0; row < height; row++) {
    const lat = mercYToLat(yTop + ((row + 0.5) / height) * (yBottom - yTop));
    const gy = ((north - lat) / (north - south)) * (ny - 1);
    const y0 = Math.min(ny - 1, Math.max(0, Math.floor(gy))), y1 = Math.min(ny - 1, y0 + 1), fy = gy - y0;
    for (let col = 0; col < width; col++) {
      const gx = ((col + 0.5) / width) * (nx - 1);
      const x0 = Math.min(nx - 1, Math.floor(gx)), x1 = Math.min(nx - 1, x0 + 1), fx = gx - x0;
      const at = (arr: number[]) =>
        arr[y0 * nx + x0] * (1 - fx) * (1 - fy) + arr[y0 * nx + x1] * fx * (1 - fy) +
        arr[y1 * nx + x0] * (1 - fx) * fy + arr[y1 * nx + x1] * fx * fy;
      const level = precipLevel(at(mm));
      if (level === 0) continue;
      const [r, g, b] = levelToRgba(level);
      data.set([r, g, b, precipAlpha(at(pr))], (row * width + col) * 4);
    }
  }
  return {
    data, width, height,
    coordinates: [[west, north], [east, north], [east, south], [west, south]],
  };
}

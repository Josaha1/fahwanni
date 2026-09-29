import { pm25Color, tempColor } from "../map/palette";
import type { Pm25Grid } from "../pm25/grid";
import type { WindGrid } from "../wind/grid";

export type Corners = [[number, number], [number, number], [number, number], [number, number]];

export interface ScalarImage {
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

/** Rasterises a scalar grid with bilinear sampling and Mercator-spaced image rows. */
export function renderScalarImage(
  grid: Pick<WindGrid, "bbox" | "nx" | "ny">,
  sample: (at: (arr: ArrayLike<number>) => number) => [number, number, number, number] | null,
  width = 256,
  height = 256,
  out?: Uint8ClampedArray,
): ScalarImage {
  const [west, south, east, north] = grid.bbox;
  const { nx, ny } = grid;
  const yTop = latToMercY(north), yBottom = latToMercY(south);
  const data = out ?? new Uint8ClampedArray(width * height * 4);
  if (data.length !== width * height * 4) throw new RangeError("Raster output size does not match image dimensions");
  if (out) data.fill(0);

  for (let row = 0; row < height; row++) {
    const lat = mercYToLat(yTop + ((row + 0.5) / height) * (yBottom - yTop));
    const gy = ((north - lat) / (north - south)) * (ny - 1);
    const y0 = Math.min(ny - 1, Math.max(0, Math.floor(gy))), y1 = Math.min(ny - 1, y0 + 1), fy = gy - y0;
    for (let col = 0; col < width; col++) {
      const gx = ((col + 0.5) / width) * (nx - 1);
      const x0 = Math.min(nx - 1, Math.floor(gx)), x1 = Math.min(nx - 1, x0 + 1), fx = gx - x0;
      const at = (arr: ArrayLike<number>) =>
        arr[y0 * nx + x0] * (1 - fx) * (1 - fy) + arr[y0 * nx + x1] * fx * (1 - fy) +
        arr[y1 * nx + x0] * (1 - fx) * fy + arr[y1 * nx + x1] * fx * fy;
      const rgba = sample(at);
      if (rgba) data.set(rgba, (row * width + col) * 4);
    }
  }
  return {
    data, width, height,
    coordinates: [[west, north], [east, north], [east, south], [west, south]],
  };
}

export function renderTempImage(grid: WindGrid, hourIndex: number, width = 256, height = 256): ScalarImage | null {
  const temp = grid.temp?.[hourIndex];
  if (!temp) return null;
  return renderScalarImage(grid, (at) => {
    const hex = tempColor(at(temp));
    return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)).concat(140) as [number, number, number, number];
  }, width, height);
}

export function renderPm25Image(grid: Pm25Grid, hourIndex: number, width = 256, height = 256): ScalarImage | null {
  const values = grid.pm25[hourIndex];
  if (!values || values.length !== grid.nx * grid.ny) return null;
  return renderScalarImage(grid, (at) => {
    const hex = pm25Color(at(values));
    return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)).concat(150) as [number, number, number, number];
  }, width, height);
}

import { pm25Color, tempColor } from "../map/palette";
import { probabilityRgba, rainModeAt, rainRgba } from "../precip/render";
import { sampleSeries, type HourlySeries } from "../timeline/store";
import { lerpGrid } from "../timeline/time";
import { latToMercY, mercYToLat, renderScalarImage, type ScalarImage } from "./render-scalar";

type GridShape = { bbox: readonly [number, number, number, number]; nx: number; ny: number };

function valuesAt(series: HourlySeries, variable: string, t: number, length: number): ArrayLike<number> | null {
  const sample = sampleSeries(series, variable, t);
  if (!sample || sample.a.length !== length || sample.b.length !== length) return null;
  return sample.exact ? sample.a : lerpGrid(sample.a, sample.b, sample.f);
}

function color(hex: string, alpha: number): [number, number, number, number] {
  return [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16), alpha];
}

export function renderRainAt(series: HourlySeries, t: number, grid: GridShape, nowMs: number, width = 512, height = 512, out?: Uint8ClampedArray): ScalarImage | null {
  const mode = rainModeAt(t - nowMs);
  const prob = valuesAt(series, "prob", t, grid.nx * grid.ny);
  const precip = mode === "probability" ? null : valuesAt(series, "precip", t, grid.nx * grid.ny);
  if (!prob || (mode !== "probability" && !precip)) return null;
  const data = out ?? new Uint8ClampedArray(width * height * 4);
  if (data.length !== width * height * 4) throw new RangeError("Raster output size does not match image dimensions");
  data.fill(0);
  const [west, south, east, north] = grid.bbox;
  const yTop = latToMercY(north), yBottom = latToMercY(south);
  let previousMm = NaN, previousProbability = NaN;
  let previousRgba: [number, number, number, number] = [0, 0, 0, 0];
  for (let row = 0; row < height; row++) {
    const lat = mercYToLat(yTop + ((row + 0.5) / height) * (yBottom - yTop));
    const gy = ((north - lat) / (north - south)) * (grid.ny - 1);
    const y0 = Math.min(grid.ny - 1, Math.max(0, Math.floor(gy))), y1 = Math.min(grid.ny - 1, y0 + 1), fy = gy - y0;
    for (let col = 0; col < width; col++) {
      const gx = ((col + 0.5) / width) * (grid.nx - 1);
      const x0 = Math.min(grid.nx - 1, Math.floor(gx)), x1 = Math.min(grid.nx - 1, x0 + 1), fx = gx - x0;
      const a = (1 - fx) * (1 - fy), b = fx * (1 - fy), c = (1 - fx) * fy, d = fx * fy;
      const i00 = y0 * grid.nx + x0, i01 = y0 * grid.nx + x1, i10 = y1 * grid.nx + x0, i11 = y1 * grid.nx + x1;
      const probability = prob[i00] * a + prob[i01] * b + prob[i10] * c + prob[i11] * d;
      const mm = mode === "probability" ? 0 : precip![i00] * a + precip![i01] * b + precip![i10] * c + precip![i11] * d;
      if (mm !== previousMm || probability !== previousProbability) {
        previousRgba = mode === "probability" ? probabilityRgba(probability) : rainRgba(mm, probability, mode);
        previousMm = mm;
        previousProbability = probability;
      }
      const rgba = previousRgba;
      if (!rgba[3]) continue;
      const offset = (row * width + col) * 4;
      data[offset] = rgba[0]; data[offset + 1] = rgba[1]; data[offset + 2] = rgba[2]; data[offset + 3] = rgba[3];
    }
  }
  return { data, width, height, coordinates: [[west, north], [east, north], [east, south], [west, south]] };
}

export function renderTempAt(series: HourlySeries, t: number, grid: GridShape, width = 256, height = 256, out?: Uint8ClampedArray): ScalarImage | null {
  const temp = valuesAt(series, "temp", t, grid.nx * grid.ny);
  return temp ? renderScalarImage(grid, (at) => color(tempColor(at(temp)), 140), width, height, out) : null;
}

export function renderPm25At(series: HourlySeries, t: number, grid: GridShape, width = 256, height = 256, out?: Uint8ClampedArray): ScalarImage | null {
  const pm25 = valuesAt(series, "pm25", t, grid.nx * grid.ny);
  return pm25 ? renderScalarImage(grid, (at) => color(pm25Color(at(pm25)), 150), width, height, out) : null;
}

import { levelToRgba } from "../nowcast/intensity";
import { renderScalarImage, type ScalarImage } from "../raster/render-scalar";
import type { WindGrid } from "../wind/grid";

export type { Corners } from "../raster/render-scalar";
export { latToMercY, mercYToLat } from "../raster/render-scalar";
export type PrecipImage = ScalarImage;

/**
 * Radar-legend bins. Model drizzle below 0.3 mm/h is dropped: at 1° resolution it otherwise
 * paints most of the map pale blue and reads as "rain everywhere".
 */
export const MIN_MM = 0.3;
/** Below this probability the model's rain is not drawn at all. */
export const MIN_PROB = 30;

export function precipLevel(mm: number): number {
  if (mm < MIN_MM) return 0;
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
  return renderScalarImage(grid, (at) => {
    const prob = at(pr);
    const level = prob < MIN_PROB ? 0 : precipLevel(at(mm));
    if (level === 0) return null;
    const [red, green, blue] = levelToRgba(level);
    return [red, green, blue, precipAlpha(prob)];
  }, width, height);
}

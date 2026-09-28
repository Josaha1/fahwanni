import { describe, expect, it } from "vitest";
import { tempColor } from "../map/palette";
import { levelToRgba } from "../nowcast/intensity";
import { MIN_PROB, precipAlpha, precipLevel, renderPrecipImage } from "../precip/render";
import type { WindGrid } from "../wind/grid";
import { latToMercY, mercYToLat, renderScalarImage, renderTempImage } from "./render-scalar";

const grid = {
  bbox: [92, 4, 110, 22], nx: 2, ny: 2, hours: [], u: [], v: [],
  source: "open-meteo", attribution: { text: "", url: "" },
} satisfies WindGrid;

describe("renderScalarImage", () => {
  it("returns the requested image dimensions and bbox corners", () => {
    const image = renderScalarImage(grid, () => [10, 20, 30, 40], 3, 5);
    expect(image.data).toHaveLength(3 * 5 * 4);
    expect(image.coordinates).toEqual([[92, 22], [110, 22], [110, 4], [92, 4]]);
  });

  it("leaves null samples transparent", () => {
    const image = renderScalarImage(grid, () => null, 2, 2);
    expect([...image.data]).toEqual(Array(16).fill(0));
  });

  it("renders a constant-temperature grid with the palette colour", () => {
    const temperatureGrid: WindGrid = { ...grid, temp: [Array(4).fill(30)] };
    const image = renderTempImage(temperatureGrid, 0, 3, 3)!;
    const hex = tempColor(30);
    expect([...image.data.slice(16, 20)]).toEqual([
      ...[1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)), 140,
    ]);
    expect(renderTempImage(grid, 0)).toBeNull();
    expect(renderTempImage(temperatureGrid, 1)).toBeNull();
  });

  it("keeps precipitation bytes identical to the previous raster loop", () => {
    const rainGrid: WindGrid = {
      ...grid, nx: 3, ny: 3,
      precip: [[0, 0.5, 2, 4, 6, 10, 15, 0.2, 8]],
      prob: [[20, 40, 60, 80, 100, 30, 50, 90, 70]],
    };
    const width = 7, height = 9;
    const legacy = new Uint8ClampedArray(width * height * 4);
    const [, south, , north] = rainGrid.bbox;
    const yTop = latToMercY(north), yBottom = latToMercY(south);
    for (let row = 0; row < height; row++) {
      const lat = mercYToLat(yTop + ((row + 0.5) / height) * (yBottom - yTop));
      const gy = ((north - lat) / (north - south)) * (rainGrid.ny - 1);
      const y0 = Math.min(rainGrid.ny - 1, Math.max(0, Math.floor(gy))), y1 = Math.min(rainGrid.ny - 1, y0 + 1), fy = gy - y0;
      for (let col = 0; col < width; col++) {
        const gx = ((col + 0.5) / width) * (rainGrid.nx - 1);
        const x0 = Math.min(rainGrid.nx - 1, Math.floor(gx)), x1 = Math.min(rainGrid.nx - 1, x0 + 1), fx = gx - x0;
        const at = (arr: number[]) =>
          arr[y0 * rainGrid.nx + x0] * (1 - fx) * (1 - fy) + arr[y0 * rainGrid.nx + x1] * fx * (1 - fy) +
          arr[y1 * rainGrid.nx + x0] * (1 - fx) * fy + arr[y1 * rainGrid.nx + x1] * fx * fy;
        const probability = at(rainGrid.prob![0]);
        const level = probability < MIN_PROB ? 0 : precipLevel(at(rainGrid.precip![0]));
        if (level === 0) continue;
        const [red, green, blue] = levelToRgba(level);
        legacy.set([red, green, blue, precipAlpha(probability)], (row * width + col) * 4);
      }
    }
    expect(renderPrecipImage(rainGrid, 0, width, height)!.data).toEqual(legacy);
  });
});

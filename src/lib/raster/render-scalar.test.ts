import { describe, expect, it } from "vitest";
import { tempColor } from "../map/palette";
import type { Pm25Grid } from "../pm25/grid";
import type { WindGrid } from "../wind/grid";
import { renderPm25Image, renderScalarImage, renderTempImage } from "./render-scalar";

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

  it.each([[10, [59, 204, 255]], [50, [255, 162, 0]]])("renders a constant PM2.5 value of %i with its palette colour", (value, rgb) => {
    const pm25Grid: Pm25Grid = {
      bbox: grid.bbox, nx: grid.nx, ny: grid.ny, hours: ["2026-09-28T00:00:00.000Z"],
      pm25: [Array(4).fill(value)], source: "open-meteo-cams",
      attribution: { text: "Air quality: Open-Meteo.com (CAMS, CC BY 4.0)", url: "https://open-meteo.com" },
    };
    const image = renderPm25Image(pm25Grid, 0, 3, 3)!;
    expect([...image.data.slice(16, 20)]).toEqual([...rgb, 150]);
    expect(renderPm25Image(pm25Grid, 1)).toBeNull();
    expect(renderPm25Image({ ...pm25Grid, pm25: [[]] }, 0)).toBeNull();
  });
});

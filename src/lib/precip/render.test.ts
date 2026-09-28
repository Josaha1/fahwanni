import { describe, expect, it } from "vitest";
import type { WindGrid } from "../wind/grid";
import { latToMercY, mercYToLat, precipAlpha, precipLevel, renderPrecipImage } from "./render";

function grid(mm: (i: number) => number, prob: (i: number) => number = () => 60): WindGrid {
  const n = 19 * 19;
  return {
    bbox: [92, 4, 110, 22], nx: 19, ny: 19, hours: [], u: [], v: [],
    precipHours: ["2026-09-28T09:00:00.000Z"],
    precip: [Array.from({ length: n }, (_, i) => mm(i))],
    prob: [Array.from({ length: n }, (_, i) => prob(i))],
    source: "open-meteo", attribution: { text: "", url: "" },
  };
}

const pixel = (img: { data: Uint8ClampedArray; width: number }, x: number, y: number) =>
  [...img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

describe("renderPrecipImage", () => {
  it("has the requested size and ImageSource corners", () => {
    const img = renderPrecipImage(grid(() => 0), 0, 64, 32)!;
    expect(img.width).toBe(64);
    expect(img.data.length).toBe(64 * 32 * 4);
    expect(img.coordinates).toEqual([[92, 22], [110, 22], [110, 4], [92, 4]]);
  });

  it("colours rain at the north-west point and leaves the south-east dry", () => {
    const img = renderPrecipImage(grid((i) => (i === 0 ? 20 : 0)), 0, 64, 64)!;
    expect(pixel(img, 0, 0)[3]).toBeGreaterThan(0);
    expect(pixel(img, 63, 63)).toEqual([0, 0, 0, 0]);
  });

  it("spaces rows in Mercator y, not latitude", () => {
    // Rain only south of 13°N (grid rows for lat ≤ 13).
    const img = renderPrecipImage(grid((i) => (22 - Math.floor(i / 19) <= 13 ? 5 : 0)), 0, 1, 512)!;
    const firstWetRow = Array.from({ length: 512 }, (_, r) => pixel(img, 0, r)[3]).findIndex((a) => a > 0);
    // Bilinear between the dry 14°N row and the 5 mm 13°N row crosses 0.1 mm at ≈13.98°N.
    const edge = 14 - 0.1 / 5;
    const merc = (latToMercY(22) - latToMercY(edge)) / (latToMercY(22) - latToMercY(4));
    const linear = (22 - edge) / (22 - 4);
    expect(Math.abs(firstWetRow / 512 - merc)).toBeLessThan(0.02);
    expect(Math.abs(firstWetRow / 512 - linear)).toBeGreaterThan(Math.abs(firstWetRow / 512 - merc));
  });

  it("hides rain the model gives under 30 % probability", () => {
    const img = renderPrecipImage(grid(() => 8, () => 20), 0, 8, 8)!;
    expect(img.data.every((v) => v === 0)).toBe(true);
  });

  it("returns null without rain data or for a missing hour", () => {
    const g = grid(() => 1);
    expect(renderPrecipImage({ ...g, precip: undefined }, 0)).toBeNull();
    expect(renderPrecipImage(g, 5)).toBeNull();
  });
});

describe("bins and alpha", () => {
  it.each([[0.05, 0], [0.29, 0], [0.5, 1], [2, 2], [6, 3], [15, 4]])("%s mm → level %s", (mm, level) => expect(precipLevel(mm)).toBe(level));
  it("clamps probability alpha to 25–80 %", () => {
    expect(precipAlpha(5)).toBe(Math.round(0.25 * 255));
    expect(precipAlpha(100)).toBe(Math.round(0.8 * 255));
    expect(precipAlpha(50)).toBe(Math.round(0.5 * 255));
  });
  it("round-trips Mercator latitude", () => {
    expect(mercYToLat(latToMercY(13.75))).toBeCloseTo(13.75, 6);
  });
});

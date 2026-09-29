import { describe, expect, it } from "vitest";
import { renderPm25Image, renderTempImage } from "./render-scalar";
import { renderPm25At, renderRainAt, renderTempAt } from "./render-at";
import { probabilityRgba, rainRgba } from "../precip/render";
import type { HourlySeries } from "../timeline/store";
import type { WindGrid } from "../wind/grid";
import type { Pm25Grid } from "../pm25/grid";

const start = Date.parse("2026-09-29T07:00:00.000Z");
const times = [start, start + 3_600_000];
const grid = { bbox: [92, 4, 110, 22] as const, nx: 19, ny: 19 };
const row = (value: number) => Array(19 * 19).fill(value);
const rows = { precip: [row(0.5), row(5)], prob: [row(40), row(80)], temp: [row(20), row(30)], pm25: [row(10), row(50)] };
const series: HourlySeries = { times, grids: Object.fromEntries(Object.entries(rows).map(([key, values]) => [key, values.map((value) => Float32Array.from(value))])) };
const wind: WindGrid = { ...grid, hours: [], u: [], v: [], precipHours: times.map((time) => new Date(time).toISOString()),
  precip: rows.precip, prob: rows.prob, temp: rows.temp, source: "open-meteo", attribution: { text: "", url: "" } };
const pm25: Pm25Grid = { ...grid, hours: times.map((time) => new Date(time).toISOString()), pm25: rows.pm25,
  source: "open-meteo-cams", attribution: { text: "Air quality: Open-Meteo.com (CAMS, CC BY 4.0)", url: "https://open-meteo.com" } };

describe("render at a model time", () => {
  it("matches the existing temperature and PM2.5 renderers on exact hours", () => {
    for (const [index, time] of times.entries()) {
      expect(renderTempAt(series, time, grid, 32, 32)?.data).toEqual(renderTempImage(wind, index, 32, 32)?.data);
      expect(renderPm25At(series, time, grid, 32, 32)?.data).toEqual(renderPm25Image(pm25, index, 32, 32)?.data);
    }
  });

  it("interpolates values before applying the rain palette", () => {
    const middle = start + 30 * 60_000;
    const rain = renderRainAt(series, middle, grid, start, 1, 1)!;
    expect([...rain.data]).toEqual(rainRgba(2.75, 60, "blend"));
    expect(rain.data).not.toEqual(renderRainAt(series, start, grid, start, 1, 1)!.data);
    expect(rain.data).not.toEqual(renderRainAt(series, times[1], grid, start, 1, 1)!.data);
    expect(renderTempAt(series, middle, grid, 1, 1)!.data).not.toEqual(renderTempAt(series, start, grid, 1, 1)!.data);
    expect(renderPm25At(series, middle, grid, 1, 1)!.data).not.toEqual(renderPm25At(series, times[1], grid, 1, 1)!.data);
  });

  it("selects blend at and before now, intensity after an hour, and probability after 48 hours", () => {
    const t = times[1];
    expect([...renderRainAt(series, t, grid, t, 1, 1)!.data]).toEqual(rainRgba(5, 80, "blend"));
    expect([...renderRainAt(series, t, grid, t + 1, 1, 1)!.data]).toEqual(rainRgba(5, 80, "blend"));
    expect([...renderRainAt(series, t, grid, t - 60 * 60_000, 1, 1)!.data]).toEqual(rainRgba(5, 80, "blend"));
    expect([...renderRainAt(series, t, grid, t - 60 * 60_000 - 1, 1, 1)!.data]).toEqual(rainRgba(5, 80, "intensity"));
    expect([...renderRainAt(series, t, grid, t - 48 * 60 * 60_000, 1, 1)!.data]).toEqual(rainRgba(5, 80, "intensity"));
    expect([...renderRainAt(series, t, grid, t - 48 * 60 * 60_000 - 1, 1, 1)!.data]).toEqual(probabilityRgba(80));
  });

  it("renders the probability outlook without precipitation data", () => {
    const probabilityOnly: HourlySeries = { times, grids: { prob: series.grids.prob } };
    expect([...renderRainAt(probabilityOnly, times[1], grid, start - 49 * 60 * 60_000, 1, 1)!.data]).toEqual(probabilityRgba(80));
    expect(renderRainAt(probabilityOnly, times[1], grid, start, 1, 1)).toBeNull();
    expect(renderRainAt({ times, grids: {} }, times[1], grid, start - 49 * 60 * 60_000)).toBeNull();
  });

  it("defaults rain to 512px while temperature and PM2.5 stay at 256px", () => {
    expect(renderRainAt(series, start, grid, start)).toMatchObject({ width: 512, height: 512 });
    expect(renderTempAt(series, start, grid)).toMatchObject({ width: 256, height: 256 });
    expect(renderPm25At(series, start, grid)).toMatchObject({ width: 256, height: 256 });
  });

  it("reuses and clears a caller-provided pixel buffer", () => {
    const out = new Uint8ClampedArray(4);
    expect(renderRainAt(series, start, grid, start, 1, 1, out)?.data).toBe(out);
    const dry = { ...series, grids: { ...series.grids, precip: [Float32Array.from(row(0)), Float32Array.from(row(0))] } };
    expect([...renderRainAt(dry, start, grid, start, 1, 1, out)!.data]).toEqual([0, 0, 0, 0]);
    expect(renderRainAt({ times, grids: {} }, start, grid, start)).toBeNull();
  });

  it.skipIf(Boolean(process.env.CI) || Boolean(process.env.SKIP_RENDER_PERF))("renders 512px 100 times within the scaled dev smoke budget", async () => {
    const out = new Uint8ClampedArray(512 * 512 * 4);
    renderRainAt(series, start + 30 * 60_000, grid, start, 512, 512, out);
    let p95 = Infinity;
    for (let attempt = 0; attempt < 3 && p95 >= 32; attempt++) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 1000));
      const durations: number[] = [];
      for (let i = 0; i < 100; i++) {
        const begin = performance.now();
        renderRainAt(series, start + 30 * 60_000, grid, start, 512, 512, out);
        durations.push(performance.now() - begin);
      }
      durations.sort((a, b) => a - b);
      p95 = durations[Math.ceil(durations.length * 0.95) - 1];
    }
    console.log(`renderRainAt 512x512 p95: ${p95.toFixed(2)} ms`);
    expect(p95).toBeLessThan(32);
  }, 15_000);
});

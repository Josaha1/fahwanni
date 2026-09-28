import { describe, expect, it } from "vitest";
import type { WindGrid } from "../wind/grid";
import type { TimelineStop } from "./frames";
import { firstRainHour, placeSeries, placeSeriesSummary, sampleScalar } from "./place-series";

const now = "2026-09-28T08:00:00.000Z";
const stops: TimelineStop[] = [
  { kind: "radar", time: "2026-09-28T07:40:00.000Z", index: 0 },
  { kind: "radar", time: "2026-09-28T07:50:00.000Z", index: 1 },
  { kind: "model", time: "2026-09-28T09:00:00.000Z", index: 0 },
  { kind: "model", time: "2026-09-28T11:00:00.000Z", index: 1 },
];

function grid(probability = 80): WindGrid {
  return {
    bbox: [100, 10, 102, 12], nx: 3, ny: 3, hours: [], u: [], v: [],
    precipHours: stops.slice(2).map((stop) => stop.time),
    precip: [Array(9).fill(0), Array.from({ length: 9 }, (_, i) => i === 4 ? 8 : 0)],
    prob: [Array(9).fill(probability), Array(9).fill(probability)],
    source: "open-meteo", attribution: { text: "", url: "" },
  };
}

describe("placeSeries", () => {
  it("samples rain only at the selected grid cell and omits older radar frames", () => {
    const series = placeSeries(grid(), stops, { lat: 11, lon: 101 }, { overhead: false, heavyNearby: false });
    expect(series.map(({ kind, level }) => [kind, level])).toEqual([["radar", 0], ["model", 0], ["model", 3]]);
    expect(series[2].prob).toBe(80);
    expect(placeSeries(grid(), stops, { lat: 12, lon: 100 })[2].level).toBe(0);
    expect(sampleScalar([0, 2, 4, 6], 2, 2, [100, 10, 102, 12], 101, 11)).toBe(3);
  });

  it("gates sampled rain below the minimum probability", () => {
    expect(placeSeries(grid(29), stops, { lat: 11, lon: 101 })[2]).toMatchObject({ level: 0, prob: 29 });
    expect(placeSeries(grid(30), stops, { lat: 11, lon: 101 })[2].level).toBe(3);
  });

  it("returns no series for a place outside the grid", () => {
    expect(placeSeries(grid(), stops, { lat: 13, lon: 101 }, { overhead: true, heavyNearby: true })).toEqual([]);
    expect(sampleScalar(Array(9).fill(0), 3, 3, [100, 10, 102, 12], 99, 11)).toBeUndefined();
  });

  it("maps only the latest radar frame from the current summary", () => {
    expect(placeSeries(grid(), stops, { lat: 11, lon: 101 }, { overhead: true, heavyNearby: false })[0].level).toBe(2);
    expect(placeSeries(grid(), stops, { lat: 11, lon: 101 }, { overhead: true, heavyNearby: true })[0].level).toBe(4);
    expect(placeSeries(grid(), stops, { lat: 11, lon: 101 }, { overhead: false, heavyNearby: true })[0].level).toBe(0);
  });

  it("returns a summary key and the first future rain hour", () => {
    const series = placeSeries(grid(), stops, { lat: 11, lon: 101 });
    expect(firstRainHour(series, now)).toBe(3);
    expect(placeSeriesSummary(series, now)).toEqual({ key: "ตอนนี้ไม่มีฝน, ฝนเริ่มราว +{n} ชม.", params: { n: 3 } });
    expect(placeSeriesSummary(placeSeries(grid(), stops, { lat: 11, lon: 101 }, { overhead: true, heavyNearby: false }), now)).toEqual({ key: "ตอนนี้มีฝน" });
    expect(firstRainHour(placeSeries(grid(20), stops, { lat: 11, lon: 101 }), now)).toBeNull();
  });
});

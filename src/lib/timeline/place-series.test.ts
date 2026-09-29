import { describe, expect, it } from "vitest";
import { firstRainHour, placeSeries, placeSeriesSummary, sampleScalar } from "./place-series";
import { mergeDays } from "./store";

const now = "2026-09-28T08:00:00.000Z";
const nowMs = Date.parse(now);
const geo = { bbox: [100, 10, 102, 12] as const, nx: 3, ny: 3 };
const hour = (h: number) => new Date(nowMs + h * 3_600_000).toISOString();

function series(probability = 80) {
  // +1 h dry, +3 h 8 mm in the centre cell only.
  return mergeDays([{
    hours: [hour(1), hour(2), hour(3)],
    precip: [Array(9).fill(0), Array(9).fill(0), Array.from({ length: 9 }, (_, i) => i === 4 ? 8 : 0)],
    prob: [Array(9).fill(probability), Array(9).fill(probability), Array(9).fill(probability)],
  }], ["precip", "prob"]);
}

describe("placeSeries", () => {
  it("samples the next model hours at the place, after a radar 'now' item", () => {
    const items = placeSeries(series(), nowMs, { lat: 11, lon: 101 }, geo, { overhead: false, heavyNearby: false }, 3);
    expect(items.map(({ kind, level }) => [kind, level])).toEqual([["radar", 0], ["model", 0], ["model", 0], ["model", 3]]);
    expect(items[3]).toMatchObject({ time: hour(3), prob: 80 });
    expect(placeSeries(series(), nowMs, { lat: 12, lon: 100 }, geo, undefined, 3)[3].level).toBe(0);
    expect(sampleScalar([0, 2, 4, 6], 2, 2, [100, 10, 102, 12], 101, 11)).toBe(3);
  });

  it("starts at the next full hour and skips hours without data", () => {
    const items = placeSeries(series(), nowMs + 20 * 60_000, { lat: 11, lon: 101 }, geo, undefined, 12);
    expect(items.filter((item) => item.kind === "model").map((item) => item.time)).toEqual([hour(1), hour(2), hour(3)]);
    expect(placeSeries(null, nowMs, { lat: 11, lon: 101 }, geo)).toHaveLength(1);
  });

  it("gates sampled rain below the minimum probability", () => {
    expect(placeSeries(series(29), nowMs, { lat: 11, lon: 101 }, geo, undefined, 3)[3]).toMatchObject({ level: 0, prob: 29 });
    expect(placeSeries(series(30), nowMs, { lat: 11, lon: 101 }, geo, undefined, 3)[3].level).toBe(3);
  });

  it("returns no series for a place outside the grid", () => {
    expect(placeSeries(series(), nowMs, { lat: 13, lon: 101 }, geo, { overhead: true, heavyNearby: true })).toEqual([]);
    expect(sampleScalar(Array(9).fill(0), 3, 3, [100, 10, 102, 12], 99, 11)).toBeUndefined();
  });

  it("maps 'now' from the current radar summary", () => {
    expect(placeSeries(series(), nowMs, { lat: 11, lon: 101 }, geo, { overhead: true, heavyNearby: false })[0].level).toBe(2);
    expect(placeSeries(series(), nowMs, { lat: 11, lon: 101 }, geo, { overhead: true, heavyNearby: true })[0].level).toBe(4);
    expect(placeSeries(series(), nowMs, { lat: 11, lon: 101 }, geo, { overhead: false, heavyNearby: true })[0].level).toBe(0);
  });

  it("returns a summary key and the first future rain hour", () => {
    const items = placeSeries(series(), nowMs, { lat: 11, lon: 101 }, geo, undefined, 3);
    expect(firstRainHour(items, now)).toBe(3);
    expect(placeSeriesSummary(items, now)).toEqual({ key: "ตอนนี้ไม่มีฝน, ฝนเริ่มราว +{n} ชม.", params: { n: 3 } });
    expect(placeSeriesSummary(placeSeries(series(), nowMs, { lat: 11, lon: 101 }, geo, { overhead: true, heavyNearby: false }, 3), now)).toEqual({ key: "ตอนนี้มีฝน" });
    expect(firstRainHour(placeSeries(series(20), nowMs, { lat: 11, lon: 101 }, geo, undefined, 3), now)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { buildLayerTimeline, buildTimeline, defaultIndex, defaultIndexFor, nextPlayIndex, playDelayMs, segmentShares, stopLabelKey, windHourFor } from "./frames";

const now = "2026-09-28T08:00:00.000Z";
const radarTimes = Array.from({ length: 6 }, (_, index) =>
  new Date(Date.UTC(2026, 8, 28, 7, index * 10)).toISOString());
const modelHours = Array.from({ length: 14 }, (_, index) =>
  new Date(Date.UTC(2026, 8, 28, 7 + index)).toISOString());

describe("timeline frames", () => {
  it("joins six radar frames with at most twelve future model hours", () => {
    const stops = buildTimeline(radarTimes, modelHours, now);
    expect(stops).toHaveLength(18);
    expect(stops.slice(0, 6)).toEqual(radarTimes.map((time, index) => ({ kind: "radar", time, index })));
    expect(stops.slice(6)).toEqual(modelHours.slice(1, 13).map((time, offset) => ({
      kind: "model", time, index: offset + 1,
    })));
    expect(defaultIndex(stops)).toBe(5);
    expect(stopLabelKey(stops[0])).toBe("เรดาร์");
    expect(stopLabelKey(stops[6])).toBe("แบบจำลอง");
  });

  it("drops model hours at or before the newest radar frame or now minus thirty minutes", () => {
    const stops = buildTimeline(
      ["2026-09-28T08:10:00Z"],
      ["2026-09-28T07:00:00Z", "2026-09-28T07:30:00Z", "2026-09-28T08:10:00Z", "2026-09-28T09:00:00Z"],
      now,
    );
    expect(stops.map((stop) => stop.index)).toEqual([0, 3]);
    expect(buildTimeline([], ["2026-09-28T07:30:00Z", "2026-09-28T07:31:00Z"], now))
      .toEqual([{ kind: "model", time: "2026-09-28T07:31:00.000Z", index: 1 }]);
  });

  it("orders stops by time while retaining source indices", () => {
    const stops = buildTimeline(
      ["2026-09-28T07:50:00Z", "2026-09-28T07:40:00Z"],
      ["2026-09-28T10:00:00Z", "2026-09-28T09:00:00Z"], now,
    );
    expect(stops.map((stop) => stop.index)).toEqual([1, 0, 1, 0]);
    expect(defaultIndex(stops)).toBe(1);
  });

  it("builds rain from radar and model hours for any hourly input", () => {
    const input = { radarTimes, modelHours, hourly: ["2026-09-28T08:00:00Z"] };
    expect(buildLayerTimeline("rain", input, now)).toEqual(buildTimeline(radarTimes, modelHours, now));
    expect(defaultIndexFor("rain", buildLayerTimeline("rain", input, now), now)).toBe(5);
  });

  it.each(["temp", "pm25"] as const)("builds %s from this UTC hour through twelve later hours", (primary) => {
    const hourly = Array.from({ length: 15 }, (_, index) =>
      new Date(Date.UTC(2026, 8, 28, 7 + index)).toISOString()).reverse();
    const stops = buildLayerTimeline(primary, { radarTimes, modelHours, hourly }, "2026-09-28T08:30:00Z");
    expect(stops).toHaveLength(13);
    expect(stops.map((stop) => stop.time)).toEqual(hourly.slice(1, 14).reverse());
    expect(stops.map((stop) => stop.index)).toEqual(Array.from({ length: 13 }, (_, index) => 13 - index));
    expect(stops.every((stop) => stop.kind === "model")).toBe(true);
    expect(defaultIndexFor(primary, stops, "2026-09-28T08:30:00Z")).toBe(0);
    expect(buildLayerTimeline(primary, { radarTimes, modelHours }, now)).toEqual([]);
    expect(buildLayerTimeline(primary, { radarTimes, modelHours, hourly: [] }, now)).toEqual([]);
    expect(defaultIndexFor(primary, [], now)).toBe(0);
  });

  it("selects the latest stop at or before now, including an exact match", () => {
    const stops = buildLayerTimeline("temp", {
      radarTimes: [], modelHours: [], hourly: ["2026-09-28T08:00:00Z", "2026-09-28T09:00:00Z"],
    }, now);
    expect(defaultIndexFor("temp", stops, "2026-09-28T08:00:00Z")).toBe(0);
    expect(defaultIndexFor("pm25", stops, "2026-09-28T09:00:00Z")).toBe(1);
    expect(defaultIndexFor("temp", stops, "2026-09-28T07:59:59Z")).toBe(0);
  });

  it("loops playback through radar and model stops", () => {
    const stops = buildTimeline(radarTimes, modelHours, now);
    expect(nextPlayIndex(stops, 3)).toBe(4);
    expect(nextPlayIndex(stops, 5)).toBe(6);
    expect(nextPlayIndex(stops, 6)).toBe(7);
    expect(nextPlayIndex(stops, 17)).toBe(0);
    expect(nextPlayIndex(stops, -1)).toBe(0);
    expect(nextPlayIndex(stops, 18)).toBe(0);
    expect(nextPlayIndex(stops.slice(6), 0)).toBe(1);
  });

  it("pauses on the default and final stops", () => {
    const stops = buildTimeline(radarTimes, modelHours, now);
    expect(playDelayMs(stops, 0, 5)).toBe(600);
    expect(playDelayMs(stops, 5, 5)).toBe(1500);
    expect(playDelayMs(stops, 6, 5)).toBe(600);
    expect(playDelayMs(stops, 17, 5)).toBe(1500);
  });

  it("uses the latest wind hour at or before the stop or now", () => {
    const hours = ["2026-09-28T07:00:00Z", "2026-09-28T08:00:00Z", "2026-09-28T09:00:00Z"];
    const stop = (time: string) => ({ kind: "model" as const, time, index: 0 });
    expect(windHourFor(stop("2026-09-28T06:59:59Z"), hours, now)).toBe(0);
    expect(windHourFor(stop("2026-09-28T08:00:00Z"), hours, now)).toBe(1);
    expect(windHourFor(stop("2026-09-28T08:59:59Z"), hours, now)).toBe(1);
    expect(windHourFor(stop("2026-09-28T12:00:00Z"), hours, now)).toBe(2);
    expect(windHourFor(undefined, hours, now)).toBe(1);
    expect(windHourFor(undefined, [], now)).toBe(0);
  });

  it("handles empty inputs and proportions for both segments", () => {
    expect(buildTimeline([], [], now)).toEqual([]);
    expect(defaultIndex([])).toBe(0);
    expect(nextPlayIndex([], 0)).toBe(0);
    expect(segmentShares([])).toEqual({ radar: 0, model: 0 });

    const stops = buildTimeline(radarTimes, modelHours, now);
    expect(segmentShares(stops).radar).toBeCloseTo(1 / 3);
    expect(segmentShares(stops).model).toBeCloseTo(2 / 3);
    expect(segmentShares(stops).radar + segmentShares(stops).model).toBe(1);
    expect(segmentShares(stops.slice(0, 6))).toEqual({ radar: 1, model: 0 });
    expect(segmentShares(stops.slice(6))).toEqual({ radar: 0, model: 1 });
    expect(defaultIndex(stops.slice(6))).toBe(0);
    expect(nextPlayIndex(stops.slice(6), 0)).toBe(1);
  });
});

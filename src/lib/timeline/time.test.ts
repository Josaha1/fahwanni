import { describe, expect, it } from "vitest";
import { DAY, HOUR, MINUTE, bracket, clampToDomain, dayLabel, handleLabel, lerpGrid, makeDomain, nearestIndex, roundTo, snapStep, timeBadge } from "./time";

const bangkok = (day: number, hour: number, minute = 0) => Date.parse(`2026-09-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`);

describe("continuous timeline time", () => {
  it("builds a seven-day domain ending at Bangkok midnight, including a local date crossing", () => {
    const now = bangkok(29, 0, 3);
    expect(makeDomain(now)).toEqual({ start: bangkok(28, 23, 0), now, end: Date.parse("2026-10-06T00:00:00+07:00") });
    expect(makeDomain(bangkok(29, 14, 37), { pastMin: 17, days: 2 })).toEqual({
      start: bangkok(29, 14, 20), now: bangkok(29, 14, 37), end: Date.parse("2026-10-01T00:00:00+07:00"),
    });
    expect([MINUTE, HOUR, DAY]).toEqual([60_000, 3_600_000, 86_400_000]);
  });

  it("rounds and clamps timestamps, with ten-minute past and one-minute future snapping", () => {
    const now = bangkok(29, 14, 37);
    const domain = makeDomain(now);
    expect(roundTo(now, 10 * MINUTE)).toBe(bangkok(29, 14, 40));
    expect(roundTo(now + 29_000, MINUTE)).toBe(now);
    expect(roundTo(now + 30_000, MINUTE)).toBe(bangkok(29, 14, 38));
    expect(clampToDomain(domain.start - MINUTE, domain)).toBe(domain.start);
    expect(clampToDomain(domain.end + MINUTE, domain)).toBe(domain.end);
    expect(snapStep(bangkok(29, 14, 24), domain)).toBe(bangkok(29, 14, 20));
    expect(snapStep(now, domain)).toBe(bangkok(29, 14, 40));
    expect(snapStep(now + 89_000, domain)).toBe(bangkok(29, 14, 38));
    expect(snapStep(domain.end + HOUR, domain)).toBe(domain.end);
  });

  it("finds exact, fractional, and edge brackets", () => {
    const times = [bangkok(29, 14), bangkok(29, 15), bangkok(29, 16)];
    expect(bracket(bangkok(29, 14, 37), times)).toEqual({ i: 0, f: 37 / 60 });
    expect(bracket(times[0] - MINUTE, times)).toEqual({ i: 0, f: 0 });
    expect(bracket(times[1], times)).toEqual({ i: 1, f: 0 });
    expect(bracket(times[2] + MINUTE, times)).toEqual({ i: 2, f: 0 });
    expect(bracket(times[0], [])).toBeNull();
    expect(bracket(times[2], [times[0]])).toEqual({ i: 0, f: 0 });
    expect(bracket(times[0], [times[0], times[0], times[1]])).toEqual({ i: 1, f: 0 });
  });

  it("interpolates grid values and falls back across NaN and infinity", () => {
    const out = new Float32Array(5);
    expect(lerpGrid([2, NaN, 4, NaN, Infinity], [6, 8, Infinity, NaN, -Infinity], 0.25, out)).toBe(out);
    expect(Array.from(out.slice(0, 3))).toEqual([3, 8, 4]);
    expect(Number.isNaN(out[3])).toBe(true);
    expect(Number.isNaN(out[4])).toBe(true);
    expect(Array.from(lerpGrid(new Float32Array([2]), new Float32Array([6]), 0.5))).toEqual([4]);
  });

  it("finds the nearest radar frame only within the allowed gap", () => {
    const first = bangkok(29, 14);
    const times = [first, first + 10 * MINUTE, first + 20 * MINUTE];
    expect(nearestIndex(first + 4 * MINUTE, times, 5 * MINUTE)).toBe(0);
    expect(nearestIndex(first + 6 * MINUTE, times, 5 * MINUTE)).toBe(1);
    expect(nearestIndex(first + 5 * MINUTE, times, 5 * MINUTE)).toBe(0);
    expect(nearestIndex(first - 6 * MINUTE, times, 5 * MINUTE)).toBe(-1);
    expect(nearestIndex(first + 26 * MINUTE, times, 5 * MINUTE)).toBe(-1);
    expect(nearestIndex(first, [], 5 * MINUTE)).toBe(-1);
  });

  it("returns Bangkok Thai label keys and actual source times for badges", () => {
    const now = bangkok(29, 14, 37);
    const domain = makeDomain(now);
    expect(handleLabel(now)).toEqual({ key: "{day} {time}", params: { day: "อ.", time: "14:37" } });
    expect(dayLabel(bangkok(29, 0))).toEqual({ key: "{day} {date} {month}", params: { day: "อ.", date: "29", month: "ก.ย." } });
    expect(dayLabel(bangkok(29, 0) - MINUTE)).toEqual({ key: "{day} {date} {month}", params: { day: "จ.", date: "28", month: "ก.ย." } });
    expect(timeBadge(now, domain, { radarTime: bangkok(29, 14, 30), onModelHour: false }))
      .toEqual({ key: "เรดาร์ {time}", params: { time: "14:30" } });
    expect(timeBadge(now + 23 * MINUTE, domain, { onModelHour: true }))
      .toEqual({ key: "พยากรณ์ {time}", params: { time: "15:00" } });
    expect(timeBadge(now + MINUTE, domain, { onModelHour: false }))
      .toEqual({ key: "พยากรณ์ · ค่าประมาณระหว่างชั่วโมง", params: {} });
    expect(timeBadge(now, domain, { onModelHour: true })).toEqual({ key: "ตอนนี้", params: {} });
  });
});

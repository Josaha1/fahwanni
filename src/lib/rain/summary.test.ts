import { describe, expect, it } from "vitest";
import { nextFrame, observedSummary, placeTotals } from "./summary";
import type { ForecastDay } from "@/lib/wind/days";
import type { ReportingRainStation } from "@/lib/rain-risk/tmd";

const station = (id: string, rainMm: number, provinceTh: string, lat = 14): ReportingRainStation => ({ id, rainMm, provinceTh, lat, lon: 100, nameTh: id, nameEn: id });
const days = (): ForecastDay[] => Array.from({ length: 7 }, (_, day) => {
  const date = `2026-10-${String(5 + day).padStart(2, "0")}`;
  return { u: [], v: [], prob: [], temp: [], feels: [], cloud: [], source: "open-meteo", attribution: { text: "Open-Meteo", url: "https://open-meteo.com" }, day, date, bbox: [99, 13, 101, 15], nx: 2, ny: 2, hours: Array.from({ length: 24 }, (_, at) => new Date(Date.parse(`${date}T00:00:00+07:00`) + at * 3600000).toISOString()), precip: Array.from({ length: 24 }, () => [0, 2, 2, 4]) } as ForecastDay;
});

describe("rain pillar summaries", () => {
  it("counts strict thresholds, includes dry stations in regional means, and finds nearest", () => {
    const data = [station("dry", 0, "เชียงใหม่", 19), station("35", 35, "เชียงใหม่", 18), station("90", 90, "กรุงเทพมหานคร"), station("91", 91, "กรุงเทพมหานคร", 13)];
    const summary = observedSummary(data, { lat: 19, lon: 100 });
    expect(summary.top?.id).toBe("91");
    expect(summary.near?.id).toBe("dry");
    expect([summary.over35, summary.over90]).toEqual([2, 1]);
    expect(summary.regions).toEqual([{ region: "central", mm: 90.5 }, { region: "north", mm: 17.5 }]);
    expect(observedSummary([], { lat: 14, lon: 100 }).near).toBeNull();
  });
  it("bilinearly samples the existing grid for full 1/3/7 calendar days", () => {
    expect(placeTotals(days(), { lat: 14, lon: 100 })).toEqual({ date: "2026-10-05", totals: [48, 144, 336] });
    expect(placeTotals(days(), { lat: 50, lon: 100 }).totals).toEqual([null, null, null]);
  });
  it("does not turn missing days or a truncated horizon into zero", () => {
    expect(placeTotals(days().filter((day) => day.day !== 2), { lat: 14, lon: 100 }).totals).toEqual([48, null, null]);
    const data = days(); data[6].hours.pop(); data[6].precip.pop();
    expect(placeTotals(data, { lat: 14, lon: 100 }).totals).toEqual([48, 144, null]);
  });
  it("wraps replay without inventing extra frames", () => {
    expect(nextFrame(11, 12)).toBe(0);
    expect(nextFrame(0, 12)).toBe(1);
    expect(nextFrame(0, 0)).toBe(0);
  });
});

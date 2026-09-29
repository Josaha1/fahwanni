import { describe, expect, it } from "vitest";
import pointsData from "../../../public/data/river-points.json";
import fixture from "./fixture-flood.json";
import { parseFlood } from "./client";
import { calendarDoy, peakAhead, rareLevel, rareLevelWord, riverAtDay, riverStatus, statusWord, summarizeRiver, trend } from "./status";
import type { RiverForecastDay, RiverPoint } from "./types";

const points = pointsData.points as RiverPoint[];
const band = { p25: 25, p50: 50, p75: 75, p90: 90 };
const day = (date: string, value: number): RiverForecastDay => ({ date, value, median: null, p25: null, p75: null });

describe("calendarDoy", () => {
  it("aligns dates around February 29 across leap and ordinary years", () => {
    expect(calendarDoy("2024-02-28")).toBe(59);
    expect(calendarDoy("2024-02-29")).toBe(60);
    expect(calendarDoy("2024-03-01")).toBe(61);
    expect(calendarDoy("2025-02-28")).toBe(59);
    expect(calendarDoy("2025-03-01")).toBe(61);
    expect(calendarDoy("2025-12-31")).toBe(366);
    expect(() => calendarDoy("2025-02-29")).toThrow(RangeError);
  });
});

it("classifies exact percentile boundaries and exposes the approved Thai words", () => {
  expect([24.9, 25, 75, 75.1, 90, 90.1].map((value) => riverStatus(value, band)))
    .toEqual(["low", "normal", "normal", "high", "high", "veryHigh"]);
  expect(["low", "normal", "high", "veryHigh"].map((status) => statusWord(status as ReturnType<typeof riverStatus>)))
    .toEqual(["ต่ำกว่าปกติ", "ปกติ", "สูงกว่าปกติ", "สูงมาก"]);
});

it("classifies annual maxima and uses the approved rarity wording", () => {
  const annualMax = { p50: 100, p80: 200 };
  expect(rareLevel(99.9, annualMax)).toBeNull();
  expect(rareLevel(100, annualMax)).toBe("yearly");
  expect(rareLevel(200, annualMax)).toBe("about5y");
  expect(rareLevelWord("yearly")).toBe("สูงเท่าที่พบราวปีละครั้ง");
  expect(rareLevelWord("about5y")).toBe("สูงเท่าที่พบราว 5 ปีครั้ง");
});

it("compares the highest value in the next three calendar days with today", () => {
  const today = "2026-09-29";
  expect(trend([day(today, 100), day("2026-09-30", 110), day("2026-10-01", 105)], today)).toBe("steady");
  expect(trend([day(today, 100), day("2026-09-30", 80), day("2026-10-01", 111)], today)).toBe("rising");
  expect(trend([day(today, 100), day("2026-09-30", 70), day("2026-10-01", 89)], today)).toBe("falling");
  expect(trend([day(today, 100)], today)).toBeNull();
  expect(trend([day(today, 100), day("2026-10-03", 200)], today)).toBeNull();
});

it("finds the peak within the next seven calendar days", () => {
  const days = [day("2026-09-29", 100), day("2026-10-01", 140), day("2026-10-06", 130), day("2026-10-07", 200)];
  expect(peakAhead(days, "2026-09-29")).toEqual({ date: "2026-10-01", value: 140 });
  expect(peakAhead(days, "2026-09-29", 1)).toBeNull();
});

it("summarizes a fixture location with the correct calendar band and seven future days", () => {
  const [forecast] = parseFlood(fixture, points);
  const summary = summarizeRiver(points[0], forecast, "2026-09-29");
  const current = forecast.days.find((item) => item.date === "2026-09-29")!;
  expect(summary?.id).toBe(points[0].id);
  expect(summary?.today).toEqual({ date: current.date, value: current.value,
    status: riverStatus(current.value, points[0].doy[273]), doyBand: points[0].doy[273] });
  expect(summary?.value2554Today).toBe(points[0].value2554[273]);
  expect(summary?.days.map((item) => item.date)).toEqual([
    "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06",
  ]);
  expect(summary?.trend).toBe(trend(forecast.days, "2026-09-29"));
  expect(summary?.peak).toEqual(peakAhead(forecast.days, "2026-09-29"));
  expect(summarizeRiver(points[0], forecast, "2027-01-01")).toBeNull();
});

it("keeps the missing 2011 value on February 29 explicit", () => {
  const point = points[0];
  const forecast = { id: point.id, days: [day("2024-02-29", point.doy[60].p50)] };
  expect(summarizeRiver(point, forecast, "2024-02-29")?.value2554Today).toBeNull();
});

it("selects today's status and each forecast day's own status", () => {
  const summary = { today: { date: "2026-09-29", value: 60, status: "normal" as const }, days: [
    { date: "2026-09-30", value: 90, status: "high" as const },
    { date: "2026-10-01", value: 120, status: "veryHigh" as const },
  ] };
  expect(riverAtDay(summary, 0)).toEqual(summary.today);
  expect(riverAtDay(summary, 1)).toEqual(summary.days[0]);
  expect(riverAtDay(summary, 2)).toEqual(summary.days[1]);
  expect(riverAtDay(summary, 7)).toBeNull();
  expect(riverAtDay(summary, -1)).toBeNull();
  expect(riverAtDay(null, 0)).toBeNull();
});

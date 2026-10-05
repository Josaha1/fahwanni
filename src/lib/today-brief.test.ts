import { describe, expect, it } from "vitest";
import { translator } from "@/i18n/core";
import type { WeatherHour, WeatherSnapshot } from "./weather/types";
import { todayBrief } from "./today-brief";

const now = "2026-09-28T03:30:00Z"; // 10:30 in Bangkok
const th = translator("th");
const snapshot = (hours: WeatherHour[] = [], heatIndexC?: number): WeatherSnapshot => ({
  hours, heatIndexC, days: [], alerts: [], timeZone: "Asia/Bangkok",
});
const hour = (utcHour: number, rainChance?: number): WeatherHour => ({
  startTime: `2026-09-28T${String(utcHour).padStart(2, "0")}:00:00Z`,
  endTime: `2026-09-28T${String(utcHour + 1).padStart(2, "0")}:00:00Z`,
  rainChance,
});

describe("todayBrief", () => {
  it("finds the least and most rainy two-hour windows remaining today", () => {
    const hours = [hour(2, 99), hour(3, 10), hour(4, 20), hour(5, 50), hour(6, 90)];
    expect(todayBrief(snapshot(hours), null, now, th).rain)
      .toBe("ฝน: น้อยสุด 10–12 · มากสุด 12–14 น.");
  });

  it("ignores past hours, tomorrow, and missing rain chances", () => {
    const hours = [hour(2, 99), hour(3, 10), hour(4), hour(5, 80), hour(17, 100)];
    expect(todayBrief(snapshot(hours), null, now, th).rain).toBe("ฝน: น้อยสุด 10–11 · มากสุด 12–13 น.");
    expect(todayBrief(snapshot([hour(4)]), null, now, th).rain).toBeUndefined();
  });

  it("uses the existing heat bands, including normal and danger", () => {
    expect(todayBrief(snapshot([], 26), null, now, th, "all").heat).toBe("ดัชนีความร้อน 26° · ปกติ");
    expect(todayBrief(snapshot([], 42), null, now, th, "all").heat).toBe("ดัชนีความร้อน 42° · อันตราย");
  });

  it("omits heat in flood focus while keeping rain and water", () => {
    const brief = todayBrief(snapshot([hour(4, 80)], 42), "high", now, th, "flood");
    expect(brief.heat).toBeUndefined();
    expect(brief.rain).toBeDefined();
    expect(brief.water).toBeDefined();
  });

  it("reports each river status as a model and translates the line", () => {
    expect(todayBrief(undefined, "high", now, th).water).toBe("น้ำใกล้คุณ: สูงกว่าปกติ (แบบจำลอง)");
    expect(todayBrief(undefined, "normal", now, translator("en")).water).toBe("Nearby water: Normal (model)");
  });

  it("omits every line when its source data is absent", () => {
    expect(todayBrief(undefined, null, now, th)).toEqual({});
    expect(todayBrief(snapshot(), null, now, th)).toEqual({});
    expect(todayBrief(snapshot([], 33), null, now, th, "all")).toEqual({ heat: "ดัชนีความร้อน 33° · เตือนภัย" });
  });
});

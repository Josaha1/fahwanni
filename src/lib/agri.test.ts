import { describe, expect, it } from "vitest";
import { rainTotalMm, soilWord, sprayWindow, toAgri } from "./agri";
import type { WeatherDay, WeatherHour } from "./weather/types";

describe("toAgri", () => {
  it("reads the real Open-Meteo shape (Khon Kaen)", () => {
    const agri = toAgri({
      daily: { time: ["2026-09-28", "2026-09-29"], et0_fao_evapotranspiration: [2.74, 4.42] },
      hourly: { time: ["2026-09-28T15:00"], soil_moisture_0_to_1cm: [0.336], soil_moisture_3_to_9cm: [0.329] },
    });
    expect(agri).toMatchObject({ available: true, et0TodayMm: 2.7, et0TomorrowMm: 4.4, soilTop: 0.34, soilRoot: 0.33 });
  });

  it("is unavailable for bad or empty data", () => {
    expect(toAgri(null).available).toBe(false);
    expect(toAgri({ daily: { et0_fao_evapotranspiration: [null] }, hourly: { soil_moisture_0_to_1cm: [null], soil_moisture_3_to_9cm: [null] } }).available).toBe(false);
  });
});

describe("soilWord", () => {
  it.each([[0.1, "dry"], [0.15, "moist"], [0.29, "moist"], [0.3, "wet"]])("%s → %s", (v, w) => expect(soilWord(v)).toBe(w));
});

describe("rainTotalMm", () => {
  it("sums day and night rain over the first n days", () => {
    const day = (d: number, n: number): WeatherDay => ({ day: { rainMm: d }, night: { rainMm: n } });
    expect(rainTotalMm([day(3.2, 1), day(0, 0.4), day(10, 0)])).toBe(15);
    expect(rainTotalMm([day(3, 0), day(5, 0)], 1)).toBe(3);
  });
});

describe("sprayWindow", () => {
  // 23:00 UTC = 06:00 Bangkok
  const make = (values: Partial<WeatherHour>[]) => values.map((v, i) => ({
    startTime: new Date(Date.parse("2026-09-27T23:00:00Z") + i * 3600_000).toISOString(), ...v,
  }));
  const calm = { windKmh: 6, gustKmh: 12, rainChance: 5 };

  it("finds the first calm hour followed by 6 dry hours", () => {
    const hours = make([{ ...calm, windKmh: 15 }, calm, calm, calm, calm, calm, calm, calm]);
    expect(sprayWindow(hours, "Asia/Bangkok", "2026-09-27T22:30:00Z")).toBe("2026-09-28T00:00:00.000Z"); // 07:00
  });

  it("rejects hours with rain coming within six hours", () => {
    const hours = make([calm, calm, calm, { ...calm, rainChance: 60 }, calm, calm, calm, calm, calm, calm, calm, calm]);
    expect(sprayWindow(hours, "Asia/Bangkok", "2026-09-27T22:30:00Z")).toBe("2026-09-28T03:00:00.000Z"); // 10:00, after the shower
  });

  it("returns undefined when it is windy all day", () => {
    expect(sprayWindow(make(Array(14).fill({ ...calm, windKmh: 18 })), "Asia/Bangkok", "2026-09-27T22:30:00Z")).toBeUndefined();
  });
});

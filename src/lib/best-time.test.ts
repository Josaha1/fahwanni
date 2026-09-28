import { describe, expect, it } from "vitest";
import { bestWindow, hourPenalty } from "./best-time";
import type { WeatherHour } from "./weather/types";

/** Hours starting at a UTC ISO; Asia/Bangkok is UTC+7. */
function hours(startUtc: string, values: Partial<WeatherHour>[]): WeatherHour[] {
  const t0 = Date.parse(startUtc);
  return values.map((v, i) => ({ startTime: new Date(t0 + i * 3600_000).toISOString(), endTime: new Date(t0 + (i + 1) * 3600_000).toISOString(), ...v }));
}

const mild: Partial<WeatherHour> = { tempC: 28, heatIndexC: 30, rainChance: 5, uvIndex: 2 };
const hot: Partial<WeatherHour> = { tempC: 35, heatIndexC: 41, rainChance: 5, uvIndex: 10 };
const wet: Partial<WeatherHour> = { tempC: 27, heatIndexC: 29, rainChance: 80, thunderChance: 40, uvIndex: 1 };

describe("hourPenalty", () => {
  it("is stricter for exercise than for going out", () => {
    const warm = { heatIndexC: 32, uvIndex: 4, rainChance: 0 };
    expect(hourPenalty(warm, "outdoor")).toBe(0);
    expect(hourPenalty(warm, "exercise")).toBeGreaterThan(0);
  });
  it("rules out exercise when PM2.5 is unhealthy", () => {
    expect(hourPenalty(mild, "exercise", 50)).toBeGreaterThanOrEqual(100);
    expect(hourPenalty(mild, "outdoor", 50)).toBeLessThan(100);
  });
});

describe("bestWindow", () => {
  // 23:00 UTC = 06:00 Bangkok. Hours: 06,07 mild; 08..15 hot; 16,17 wet; 18,19 mild.
  const day = hours("2026-09-27T23:00:00Z", [mild, mild, ...Array(8).fill(hot), wet, wet, mild, mild, mild]);

  it("picks the coolest dry consecutive window in local daytime", () => {
    const w = bestWindow(day, "Asia/Bangkok", "2026-09-27T22:30:00Z", "exercise")!;
    expect(w.start).toBe("2026-09-27T23:00:00.000Z"); // 06:00 Bangkok
    expect(w.end).toBe("2026-09-28T01:00:00.000Z");   // 08:00 Bangkok
    expect(w.good).toBe(true);
  });

  it("only looks forward from the current hour", () => {
    const w = bestWindow(day, "Asia/Bangkok", "2026-09-28T03:30:00Z", "outdoor")!; // 10:30 Bangkok
    expect(w.start).toBe("2026-09-28T11:00:00.000Z"); // 18:00 Bangkok
  });

  it("ignores night hours", () => {
    const night = hours("2026-09-28T14:00:00Z", Array(6).fill(mild)); // 21:00–02:00 Bangkok
    expect(bestWindow(night, "Asia/Bangkok", "2026-09-28T13:00:00Z", "outdoor")).toBeUndefined();
  });

  it("marks the window not good when every option is uncomfortable", () => {
    const allHot = hours("2026-09-27T23:00:00Z", Array(14).fill(hot));
    expect(bestWindow(allHot, "Asia/Bangkok", "2026-09-27T22:30:00Z", "exercise")!.good).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { weeklyOutlook } from "./outlook";
import type { WeatherDay } from "./weather/types";

const day = (date: string, maxTempC: number, minTempC: number, rainChance = 10, rainMm = 0): WeatherDay => ({
  date, maxTempC, minTempC, day: { rainChance, rainMm }, night: {},
});

describe("weeklyOutlook", () => {
  it("counts rainy days by chance or amount and finds extremes", () => {
    const outlook = weeklyOutlook([
      day("2026-09-28", 33, 25, 70),
      day("2026-09-29", 34, 26, 20, 6),
      day("2026-09-30", 32, 24, 10),
      day("2026-10-01", 35, 25, 60),
      day("2026-10-02", 33, 23),
      day("2026-10-03", 33, 25),
      day("2026-10-04", 32, 25),
      day("2026-10-05", 40, 30, 90),
    ])!;
    expect(outlook.days).toBe(7);
    expect(outlook.rainyDays).toBe(3);
    expect(outlook.hottest).toEqual({ date: "2026-10-01", maxC: 35 });
    expect(outlook.coolest).toEqual({ date: "2026-10-02", minC: 23 });
    expect(outlook.trend).toBe("steady");
  });

  it.each([
    [[30, 30, 30, 31, 33, 33, 34], "warmer"],
    [[34, 34, 33, 32, 31, 31, 30], "cooler"],
  ])("trend %j → %s", (maxes, trend) => {
    const days = maxes.map((max, i) => day(`2026-10-0${i + 1}`, max, 24));
    expect(weeklyOutlook(days)!.trend).toBe(trend);
  });

  it("needs at least three dated days", () => {
    expect(weeklyOutlook([day("2026-10-01", 30, 24), day("2026-10-02", 30, 24)])).toBeUndefined();
    expect(weeklyOutlook([])).toBeUndefined();
  });
});

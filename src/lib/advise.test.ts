import { describe, expect, it } from "vitest";
import { advise, heatBand } from "./advise";
import type { WeatherSnapshot } from "./weather/types";

const now = "2026-09-28T08:00:00Z";
const hour = (at: string, rainChance?: number, thunderChance?: number) => ({
  startTime: `2026-09-28T${at}:00Z`, rainChance, thunderChance,
});
const day = (maxTempC?: number, rainMm?: number) => ({ maxTempC, day: { rainMm }, night: {} });
const base = (): WeatherSnapshot => ({ hours: [], days: [], alerts: [], isDaytime: false, timeZone: "Asia/Bangkok" });

describe("heatBand", () => {
  it.each([
    [26.9, "none"], [27, "caution"], [32, "caution"], [33, "warning"],
    [41, "warning"], [42, "danger"], [51, "danger"], [52, "extreme"],
  ] as const)("maps %s°C to %s", (c, band) => {
    expect(heatBand(c)).toBe(band);
  });
});

describe("advise", () => {
  it.each([
    ["umbrella", { hours: [hour("09", 40)] }, {}, "tip"],
    ["storm", { hours: [hour("09", 0, 50)] }, {}, "warn"],
    ["heat", { heatIndexC: 33 }, {}, "tip"],
    ["uv", { uvIndex: 8 }, {}, "warn"],
    ["wind", { gustKmh: 50 }, {}, "warn"],
    ["cooler", { days: [day(35), day(32)] }, {}, "tip"],
    ["sticky", { humidity: 85, tempC: 32 }, {}, "tip"],
    ["rain-start", { hours: [hour("14", 50)] }, {}, "tip"],
    ["commute-rain", { hours: [hour("09", 40)] }, {}, "tip"],
    ["laundry-ok", { isDaytime: true, humidity: 74, hours: [hour("09", 19)] }, {}, "tip"],
    ["laundry-no", { isDaytime: true, humidity: 75, hours: [hour("09", 19)] }, {}, "tip"],
    ["exercise-ok", { isDaytime: true }, { pm25: 15 }, "tip"],
    ["exercise-no", { heatIndexC: 42 }, {}, "warn"],
    ["flood", { days: [day(35, 35)] }, {}, "warn"],
    ["pm25", {}, { pm25: 25.1 }, "tip"],
  ] as [string, Partial<WeatherSnapshot>, { pm25?: number }, "warn" | "tip"][])("triggers %s", (id, changes, air, severity) => {
    expect(advise({ ...base(), ...changes }, air, now)).toContainEqual(expect.objectContaining({ id, severity }));
  });

  it.each([
    ["umbrella", { hours: [hour("09", 39)] }, {}],
    ["storm", { hours: [hour("09", 0, 49)] }, {}],
    ["heat", { heatIndexC: 32 }, {}],
    ["uv", { uvIndex: 5 }, {}],
    ["wind", { gustKmh: 49 }, {}],
    ["cooler", { days: [day(35), day(32.1)] }, {}],
    ["sticky", { humidity: 84, tempC: 32 }, {}],
    ["rain-start", { hours: [hour("09", 49)] }, {}],
    ["commute-rain", { hours: [hour("13", 40)] }, {}],
    ["laundry-ok", { isDaytime: true, humidity: 75, hours: [hour("09", 19)] }, {}],
    ["laundry-no", { isDaytime: true, humidity: 74, hours: [hour("09", 19)] }, {}],
    ["exercise-ok", { isDaytime: true }, {}],
    ["exercise-no", { heatIndexC: 41, hours: [hour("09", 59)] }, { pm25: 37.5 }],
    ["flood", { days: [day(35, 34.9), day(35, 0), day(35, 1)] }, {}],
    ["pm25", {}, { pm25: 25 }],
  ] as [string, Partial<WeatherSnapshot>, { pm25?: number }][])("does not trigger %s", (id, changes, air) => {
    expect(advise({ ...base(), ...changes }, air, now).map((item) => item.id)).not.toContain(id);
  });

  it("uses danger and extreme heat severity and PM2.5 thresholds", () => {
    for (const [value, band] of [[42, "danger"], [52, "extreme"]] as const) {
      expect(advise({ ...base(), heatIndexC: value }, {}, now)).toContainEqual({ id: "heat", severity: "warn", params: { band } });
    }
    for (const [value, severity, band] of [
      [15, undefined, undefined], [15.1, undefined, undefined], [25, undefined, undefined],
      [25.1, "tip", "moderate"], [37.5, "tip", "moderate"],
      [37.6, "warn", "starting-to-affect"], [75, "warn", "starting-to-affect"], [75.1, "warn", "affects-health"],
    ] as const) {
      expect(advise(base(), { pm25: value }, now).find((item) => item.id === "pm25"))
        .toEqual(severity ? { id: "pm25", severity, params: { band } } : undefined);
    }
  });

  it("uses snapshot timezone for displayed hours and commute windows", () => {
    const snapshot = { ...base(), hours: [hour("09", 50)] };
    expect(advise(snapshot, {}, now).map((item) => item.id)).not.toContain("rain-start");
    expect(advise(snapshot, {}, now)).toContainEqual({ id: "commute-rain", severity: "tip", params: { hour: "16:00" } });
    expect(advise({ ...snapshot, timeZone: "UTC" }, {}, now).map((item) => item.id)).not.toContain("rain-start");
    expect(advise({ ...snapshot, timeZone: "UTC" }, {}, now)).toContainEqual({ id: "commute-rain", severity: "tip", params: { hour: "09:00" } });
    expect(advise({ ...base(), hours: [hour("13", 50), hour("09", 50)] }, {}, now))
      .toContainEqual({ id: "commute-rain", severity: "tip", params: { hour: "16:00" } });
    const distinct = advise({ ...base(), hours: [hour("10", 50), hour("09", 40)] }, {}, now);
    expect(distinct).toContainEqual({ id: "rain-start", severity: "tip", params: { hour: "17:00" } });
    expect(distinct).toContainEqual({ id: "commute-rain", severity: "tip", params: { hour: "16:00" } });
  });

  it("limits forecasts to the next six hours and exercise rain to three", () => {
    const snapshot = { ...base(), hours: [hour("11", 60), hour("14", 80)] };
    expect(advise(snapshot, {}, now).map((item) => item.id)).toContain("umbrella");
    expect(advise(snapshot, {}, now).map((item) => item.id)).not.toContain("exercise-no");
    expect(advise({ ...base(), hours: [hour("14", 80)] }, {}, now).map((item) => item.id)).toEqual(["rain-start"]);
  });

  it("includes the hour in progress with or without an end time", () => {
    for (const currentHour of [
      hour("11", 80),
      { ...hour("11", 80), endTime: "2026-09-28T12:00:00Z" },
    ]) {
      expect(advise({ ...base(), hours: [currentHour] }, {}, "2026-09-28T11:17:00Z"))
        .toContainEqual({ id: "umbrella", severity: "tip" });
    }
  });

  it.each(["LIGHT_RAIN", "LIGHT_THUNDERSTORM_RAIN"])("shows raining now for current %s and skips rain-start", (conditionType) => {
    const advice = advise({ ...base(), conditionType, timeZone: "UTC", hours: [hour("12", 65), hour("13", 70)] }, {}, "2026-09-28T12:17:00Z");
    expect(advice).toContainEqual({ id: "raining-now", severity: "tip" });
    expect(advice.map((item) => item.id)).not.toContain("rain-start");
  });

  it("only announces rain-start for an hour starting after now", () => {
    const current = hour("12", 65);
    const snapshot = { ...base(), conditionType: "CLOUDY", timeZone: "UTC", hours: [current] };
    expect(advise(snapshot, {}, "2026-09-28T12:17:00Z").map((item) => item.id)).not.toContain("rain-start");
    expect(advise({ ...snapshot, hours: [current, hour("13", 70)] }, {}, "2026-09-28T12:17:00Z"))
      .toContainEqual({ id: "rain-start", severity: "tip", params: { hour: "13:00" } });
  });

  it("uses the snapshot timezone for laundry daytime", () => {
    const snapshot = { ...base(), isDaytime: true, humidity: 70, hours: [hour("09", 0)] };
    expect(advise(snapshot, {}, now).map((item) => item.id)).toContain("laundry-ok");
    expect(advise({ ...snapshot, timeZone: "Pacific/Honolulu" }, {}, now).map((item) => item.id))
      .not.toContain("laundry-ok");
  });

  it("warns for at least 10 mm on each of the first three days", () => {
    expect(advise({ ...base(), days: [day(30, 12), day(30, 12), day(30, 12)] }, {}, now))
      .toContainEqual({ id: "flood", severity: "warn" });
  });

  it("does not count rain chance or later days toward flood risk", () => {
    const lightRain = [day(30, 2), day(30, 2), day(30, 2)]
      .map((forecast) => ({ ...forecast, day: { ...forecast.day, rainChance: 40 } }));
    expect(advise({ ...base(), days: lightRain }, {}, now).map((item) => item.id))
      .not.toContain("flood");
    expect(advise({ ...base(), days: [...lightRain, day(), day(), day(30, 50)] }, {}, now)
      .map((item) => item.id)).not.toContain("flood");
  });

  it("sorts warnings first, caps tips at three, and keeps choices exclusive", () => {
    const advice = advise({
      ...base(), isDaytime: true, uvIndex: 8, gustKmh: 50, humidity: 74,
      days: [day(35), day(31)], hours: [hour("09", 60)],
    }, { pm25: 40 }, now);
    const ids = advice.map((item) => item.id);
    const firstTip = advice.findIndex((item) => item.severity === "tip");
    expect(advice.slice(0, firstTip).every((item) => item.severity === "warn")).toBe(true);
    expect(advice.filter((item) => item.severity === "tip")).toHaveLength(3);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("exercise-ok");
    expect(ids).not.toContain("laundry-ok");
    expect(advise({ ...base(), isDaytime: true, humidity: 70, hours: [hour("09", 0)] }, { pm25: 10 }, now)
      .map((item) => item.id)).toEqual(["laundry-ok", "exercise-ok"]);
  });
});

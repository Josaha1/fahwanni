import { describe, expect, it } from "vitest";
import { forecastForRun, longWeekends, THAI_HOLIDAYS } from "./holidays";

describe("longWeekends", () => {
  it("finds Fri 23 Oct 2026 (วันปิยมหาราช) + weekend", () => {
    expect(longWeekends("2026-10-18")).toEqual([
      { start: "2026-10-23", end: "2026-10-25", days: ["2026-10-23", "2026-10-24", "2026-10-25"], names: ["วันปิยมหาราช"] },
    ]);
  });

  it("does not count a lone mid-week holiday (Tue 13 Oct 2026)", () => {
    expect(longWeekends("2026-10-09", 6)).toEqual([]);
  });

  it("finds Sat 5 – Mon 7 Dec 2026 (วันพ่อ + ชดเชย)", () => {
    const [run] = longWeekends("2026-12-01");
    expect(run.start).toBe("2026-12-05");
    expect(run.end).toBe("2026-12-07");
    expect(run.names).toEqual(["วันพ่อแห่งชาติ", "ชดเชยวันพ่อแห่งชาติ"]);
  });

  it("joins New Year across years into one run", () => {
    const [run] = longWeekends("2026-12-28");
    expect(run.start).toBe("2026-12-31");
    expect(run.end).toBe("2027-01-03");
  });

  it("includes a run already underway today", () => {
    expect(longWeekends("2026-12-06")[0].start).toBe("2026-12-05");
  });

  it("ignores plain weekends", () => {
    expect(longWeekends("2026-09-14", 7)).toEqual([]);
  });

  it("has only valid ISO dates", () => {
    for (const date of Object.keys(THAI_HOLIDAYS)) expect(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(date);
  });
});

describe("forecastForRun", () => {
  const run = longWeekends("2026-10-18")[0]; // 23–25 Oct
  const day = (date: string, min: number, max: number, rainDay: number, rainNight: number) => ({ date, minTempC: min, maxTempC: max, day: { rainChance: rainDay }, night: { rainChance: rainNight } });

  it("summarises only the run's days", () => {
    const days = [day("2026-10-22", 20, 40, 99, 99), day("2026-10-23", 24.6, 32.4, 40, 20), day("2026-10-24", 23.2, 33.5, 70, 10), day("2026-10-25", 25, 31, 10, 5)];
    expect(forecastForRun(run, days)).toEqual({ covered: 3, rainChanceMax: 70, minC: 23, maxC: 34 });
  });

  it("reports partial or no coverage", () => {
    expect(forecastForRun(run, [day("2026-10-23", 24, 32, 30, 10)]).covered).toBe(1);
    expect(forecastForRun(run, [])).toEqual({ covered: 0 });
  });
});

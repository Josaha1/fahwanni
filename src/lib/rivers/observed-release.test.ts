import { describe, expect, it } from "vitest";
import type { DamTrend } from "../dams/trend";
import { sumRelease } from "./observed";

const trend: DamTrend = {
  dates: ["2026-09-24", "2026-09-25", "2026-09-30"],
  pct: {},
  inflow: {},
  release: { a: [10, null, 30], b: [5, 6, 7] },
};

describe("sumRelease", () => {
  it("sums today's release per dam and keeps each dam's date", () => {
    const result = sumRelease(["a", "b"], [
      { id: "a", date: "2026-09-30", releaseCms: 30 }, { id: "b", date: "2026-09-29", releaseCms: 7 },
    ], trend)!;
    expect(result.today).toEqual({ date: "2026-09-29", totalCms: 37, missing: [] });
    expect(result.dams).toEqual([
      { damId: "a", releaseCms: 30, date: "2026-09-30" }, { damId: "b", releaseCms: 7, date: "2026-09-29" },
    ]);
  });

  it("lists a dam that did not report instead of counting it as 0", () => {
    const result = sumRelease(["a", "b"], [{ id: "a", date: "2026-09-30", releaseCms: 30 }], trend)!;
    expect(result.today).toEqual({ date: "2026-09-30", totalCms: 30, missing: ["b"] });
    expect(result.trend).toBeNull();
  });

  it("draws only days where every dam reported and compares today with the first complete day", () => {
    const result = sumRelease(["a", "b"], [
      { id: "a", date: "2026-09-30", releaseCms: 30 }, { id: "b", date: "2026-09-30", releaseCms: 7 },
    ], trend)!;
    expect(result.days).toEqual([
      { date: "2026-09-24", totalCms: 15 }, { date: "2026-09-25", totalCms: null }, { date: "2026-09-30", totalCms: 37 },
    ]);
    expect(result.trend).toBe("rising");
  });

  it("returns null without dams and tolerates a missing trend", () => {
    expect(sumRelease([], [], trend)).toBeNull();
    const result = sumRelease(["a"], [{ id: "a", date: "2026-09-30", releaseCms: 4 }], null)!;
    expect(result.days).toEqual([]);
    expect(result.trend).toBeNull();
  });
});

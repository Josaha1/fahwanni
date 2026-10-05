import { describe, expect, it } from "vitest";
import { nationalDrainage, sevenDayChange, inProvince } from "./pillar";
import { buildTrend } from "./trend";
import { parseRidDams } from "./rid";
import fixture from "./fixture-rid.json";

const dam = parseRidDams(fixture).dams.find((dam) => dam.id === "200101")!;

describe("drainage pillar", () => {
  it("excludes yesterday's back-fill from today's totals and counts missing flow separately", () => {
    const current = { ...dam, date: "2026-10-05", releaseCms: 0, inflowCms: null, storagePct: 101 };
    const old = { ...dam, id: "200102", date: "2026-10-04", releaseCms: 100, inflowCms: 10 };
    const trend = buildTrend([{ date: "2026-10-04", dams: [old] }]);
    const summary = nationalDrainage([current, old], current.date, trend);
    expect(summary.today).toEqual({ value: 0, missing: 34 });
    expect(summary.yesterday).toEqual({ value: 100, missing: 34 });
    expect(summary.over80).toBe(1);
    expect(summary.over100).toBe(1);
    expect(summary.missingStorage).toBe(34);
    expect(summary.releasingMore).toBe(0);
    expect(summary.missingComparison).toBe(35);
    expect(nationalDrainage([], current.date, null).today).toEqual({ value: null, missing: 35 });
  });
  it("requires both flow reports and applies strict capacity thresholds", () => {
    const current = { ...dam, date: "2026-10-05", releaseCms: 10, inflowCms: 0, storagePct: 80 };
    const summary = nationalDrainage([current], current.date, null);
    expect(summary.releasingMore).toBe(1);
    expect(summary.over80).toBe(0);
    expect(summary.over100).toBe(0);
    expect(summary.yesterday.value).toBeNull();
  });
  it("compares exact seven-day endpoints without substituting available dates", () => {
    const trend = buildTrend([
      { date: "2026-09-28", dams: [{ ...dam, date: "2026-09-28", storagePct: 80 }] },
      { date: "2026-10-05", dams: [{ ...dam, date: "2026-10-05", storagePct: 90 }] },
    ]);
    expect(sevenDayChange(trend, dam.id, "2026-10-05")).toBe(10);
    expect(sevenDayChange(trend, dam.id, "2026-10-04")).toBeNull();
  });
  it("includes dams located in the province or linked by the downstream route", () => {
    expect(inProvince(dam, "tak", {})).toBe(true);
    expect(inProvince(dam, "bangkok", { [dam.id]: { provinces: [{ id: "bangkok" }] } })).toBe(true);
    expect(inProvince(dam, "bangkok", {})).toBe(false);
  });
});

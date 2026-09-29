import { describe, expect, it } from "vitest";
import { ageMinutes, freshnessRows } from "./freshness";

describe("data freshness", () => {
  it("lists every source with a parsed time, unknown as null", () => {
    const rows = freshnessRows({ radarTime: "2026-09-29T10:00:00.000Z", damsDate: "2026-09-29",
      rainObservedAt: "2026-09-29T07:00:00+07:00", warningAt: "2026-09-29 05:00:00" });
    expect(rows.map((row) => row.key)).toEqual(["radar", "model", "dams", "rain", "rivers", "warnings"]);
    expect(rows[0].time).toBe(Date.parse("2026-09-29T10:00:00.000Z"));
    expect(rows[1].time).toBeNull();
    expect(rows[2].time).toBe(Date.parse("2026-09-29T07:00:00+07:00"));
    expect(rows[5].time).toBe(Date.parse("2026-09-29T05:00:00+07:00"));
    expect(rows.filter((row) => row.daily).map((row) => row.key)).toEqual(["dams", "rain", "rivers"]);
  });

  it("gives ages in minutes", () => {
    expect(ageMinutes(null, 0)).toBeNull();
    expect(ageMinutes(0, 90 * 60_000)).toBe(90);
    expect(ageMinutes(120_000, 60_000)).toBe(0);
  });

  it("tells an empty warning list apart from one not loaded", () => {
    expect(freshnessRows({ warningAt: null })[5].none).toBe(true);
    expect(freshnessRows({})[5].none).toBe(false);
  });

  it("shows the UTC flood observation date as a daily NASA row", () => {
    const row = freshnessRows({ satFloodDate: "2026-09-28" }).find((item) => item.key === "sat-flood");
    expect(row).toEqual({ key: "sat-flood", label: "น้ำท่วมจากดาวเทียม", source: "NASA LANCE / GIBS",
      time: Date.parse("2026-09-28T00:00:00Z"), daily: true });
  });
  it("shows both satellite weather sources, including unavailable observations", () => {
    const rows = freshnessRows({ himawariTime: "2026-09-29T13:20:00Z", imergTime: null });
    expect(rows.find((row) => row.key === "himawari")).toMatchObject({ source: "Himawari (JMA) via NASA GIBS", time: Date.parse("2026-09-29T13:20:00Z"), daily: false });
    expect(rows.find((row) => row.key === "imerg")).toMatchObject({ source: "IMERG (NASA GPM)", time: null, daily: false });
  });
});

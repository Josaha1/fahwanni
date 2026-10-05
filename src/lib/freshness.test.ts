import { describe, expect, it } from "vitest";
import { ageMinutes, freshnessRows, sourceTimeMs, staleness } from "./freshness";

describe("staleness", () => {
  const at = Date.parse("2026-10-04T00:00:00+07:00");
  const hour = 3_600_000;
  it.each([
    [24, "fresh"], [24 + 1 / hour, "yesterday"], [48, "yesterday"], [48 + 1 / hour, "old"],
  ] as const)("daily after %s hours is %s", (hours, expected) => {
    expect(staleness("2026-10-04", "daily", at + hours * hour)).toBe(expected);
  });
  it.each([["rain24h", 36], ["satellite", 72]] as const)("%s becomes old strictly after %s hours", (kind, hours) => {
    expect(staleness(new Date(at), kind, at + hours * hour)).toBe("fresh");
    expect(staleness(new Date(at), kind, at + hours * hour + 1)).toBe("old");
  });
  it("never marks a monthly report or a model stale", () => {
    expect(staleness("2026-07", "monthly", at)).toBe("fresh");
    expect(staleness("2020-01-01", "model", at)).toBe("fresh");
  });
  it("parses Thai local timestamps independently of the machine timezone", () => {
    expect(sourceTimeMs("2026-10-04 14:00:00")).toBe(Date.parse("2026-10-04T07:00:00Z"));
    expect(sourceTimeMs("2026-10-04T14:00")).toBe(Date.parse("2026-10-04T07:00:00Z"));
    expect(sourceTimeMs("2026-10-04T07:00:00Z")).toBe(Date.parse("2026-10-04T07:00:00Z"));
    expect(sourceTimeMs("invalid")).toBeNull();
    expect(staleness(null, "daily", at)).toBe("fresh");
    expect(staleness(at + hour, "daily", at)).toBe("fresh");
  });
});

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

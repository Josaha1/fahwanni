import { describe, expect, it } from "vitest";
import fixture from "./fixture-rid.json";
import { parseRidDams } from "./rid";
import { buildTrend, trendDates, trendDelta } from "./trend";

describe("dam history", () => {
  it("lists the seven previous calendar dates across a month boundary", () => {
    expect(trendDates("2026-03-02")).toEqual([
      "2026-02-23", "2026-02-24", "2026-02-25", "2026-02-26",
      "2026-02-27", "2026-02-28", "2026-03-01",
    ]);
  });

  it("aligns reports by date and leaves absent dams null", () => {
    const today = parseRidDams(fixture);
    const earlier = parseRidDams({ ...fixture, date: "2026-09-27", data: fixture.data.map((group, index) => ({
      ...group, dam: index === 0 ? group.dam.slice(1) : group.dam.map((dam) => ({ ...dam, percent_storage: dam.percent_storage - 2 })),
    })) });
    const trend = buildTrend([
      { date: fixture.date, dams: today.dams },
      { date: "2026-09-27", dams: earlier.dams },
    ]);
    expect(trend.dates).toEqual(["2026-09-27", fixture.date]);
    expect(trend.pct[today.dams[0].id]).toEqual([null, today.dams[0].storagePct]);
    expect(trendDelta(trend.pct[today.dams[0].id])).toBeNull();
    expect(trendDelta(trend.pct[today.dams.at(-1)!.id])).toBeCloseTo(2);
  });

  it("records release per report date and never a back-filled value", () => {
    const today = parseRidDams(fixture);
    const [first, second] = today.dams;
    const trend = buildTrend([
      { date: "2026-09-29", dams: [{ ...first, date: "2026-09-29", releaseCms: 10, inflowCms: 20 }, { ...second, date: "2026-09-29", releaseCms: 5, inflowCms: 7 }] },
      // morning back-fill: `second` still carries yesterday's report
      { date: "2026-09-30", dams: [{ ...first, date: "2026-09-30", releaseCms: 12, inflowCms: null }, { ...second, date: "2026-09-29", releaseCms: 5, inflowCms: 7 }] },
    ]);
    expect(trend.release[first.id]).toEqual([10, 12]);
    expect(trend.release[second.id]).toEqual([5, null]);
    expect(trend.inflow[first.id]).toEqual([20, null]);
    expect(trend.inflow[second.id]).toEqual([7, null]);
    expect(trend.pct[second.id]).toEqual([second.storagePct, null]);
  });
});

import { describe, expect, it } from "vitest";
import { dateOf, nearestStation, stationsFromCsv, summarizeGaugeCsv, dropOutliers } from "./gauges.mjs";

describe("HII gauge CSV", () => {
  it("parses quoted station names and selects the closest station within 10 km", () => {
    const { stations } = stationsFromCsv('station_code,station_name,latitude,longitude,bank_level\n011,"River, North",18.8,99,301.5\n012,Far,19.2,99,\n');
    expect(stations[0]).toMatchObject({ code: "011", name: "River, North", bankMsl: 301.5 });
    expect(nearestStation({ lat: 18.79, lon: 99 }, stations)?.code).toBe("011");
    expect(nearestStation({ lat: 15, lon: 100 }, stations)).toBeNull();
  });

  it("summarizes daily means from timestamp rows and an optional bank level", () => {
    const csv = "date_time,water_level_msl,bank_level\n2026-07-01 08:00,2,6\n2026-07-01 16:00,4,6\n2026-07-02,5,6\n2026-08-01,99,6\n";
    expect(summarizeGaugeCsv(csv, "2026-07")).toMatchObject({
      levelMsl: { min: 3, mean: 4, max: 5 }, bankMsl: 6,
      days: { from: "2026-07-01", to: "2026-07-02", count: 2 },
    });
  });

  it("ignores blank values and invalid dates without a bank column", () => {
    const csv = "observed_at,level_msl\n2026-07-01,\n2026-07-02,0\n2026-07-03,2\n2026-07-33,4\n";
    expect(summarizeGaugeCsv(csv, "2026-07")).toMatchObject({
      levelMsl: { min: 0, mean: 1, max: 2 }, bankMsl: null,
      days: { from: "2026-07-02", to: "2026-07-03", count: 2 },
    });
  });

  it("accepts slash dates and reports unknown columns", () => {
    expect(dateOf("2569/07/01 00:00")).toBe("2026-07-01");
    expect(() => summarizeGaugeCsv("date,unknown\n2026-07-01,1\n", "2026-07"))
      .toThrow(/CSV headers: date, unknown/);
  });
});

describe("gauge quality rules", () => {
  it("drops logger faults far from the median", () => {
    expect(dropOutliers([15.1, 15.3, 20833.83, 15.2, 0.39])).toEqual([15.1, 15.3, 15.2]);
  });

  it("picks a main-stream gauge on the same river, never a canal gauge", () => {
    const point = { lat: 14.35, lon: 100.58, river: "Chao Phraya" };
    const stations = [
      { code: "HDA002", name: "ปตร.กระมัง (ปากคลองข้าวเม่า)", lat: 14.351, lon: 100.581, subBasin: "ที่ราบแม่น้ำเจ้าพระยา" },
      { code: "YOM999", name: "ยมที่ไหนสักแห่ง", lat: 14.352, lon: 100.58, subBasin: "แม่น้ำยมตอนล่าง" },
      { code: "C.35", name: "อยุธยา", lat: 14.36, lon: 100.59, subBasin: "ที่ราบแม่น้ำเจ้าพระยา" },
    ];
    expect(nearestStation(point, stations)?.code).toBe("C.35");
  });
});

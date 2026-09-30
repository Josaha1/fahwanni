import { describe, expect, it } from "vitest";
import fixture from "./fixture-rid.json";
import { parseRidDams } from "./rid";
import { nearestDams, oldestDifferentDamDate, waterSummary } from "./summary";

const dams = parseRidDams(fixture).dams;

describe("water summary", () => {
  it("selects the oldest dam date that differs from the payload date", () => {
    expect(oldestDifferentDamDate([], "2026-09-30")).toBeNull();
    expect(oldestDifferentDamDate([{ date: "2026-09-30" }], "2026-09-30")).toBeNull();
    expect(oldestDifferentDamDate([
      { date: "2026-09-30" }, { date: "2026-09-29" }, { date: "2026-09-28" }, { date: "2026-09-29" },
    ], "2026-09-30")).toBe("2026-09-28");
  });

  it("counts overlapping storage bands, releases, and ready rain stations", () => {
    expect(waterSummary(dams, null)).toEqual({ over80: 15, over100: 2, highRelease: 4, heavyRain: null });
    expect(waterSummary(dams, [])).toEqual({ over80: 15, over100: 2, highRelease: 4, heavyRain: 0 });
    expect(waterSummary(dams, [{ id: "station", nameTh: "สถานี", nameEn: "Station", provinceTh: "กรุงเทพมหานคร",
      lat: 13.7279, lon: 100.5241, rainMm: 36, category: "heavy" }])).toEqual({ over80: 15, over100: 2, highRelease: 4, heavyRain: 1 });
  });

  it("finds the three nearest fixture dams from Bangkok in distance order", () => {
    const result = nearestDams(dams, { lat: 13.7279, lon: 100.5241 });
    expect(result.map(({ dam }) => dam.id)).toEqual(["100503", "100501", "100504"]);
    expect(result.map(({ km }) => km)).toEqual([...result.map(({ km }) => km)].sort((a, b) => a - b));
  });
});

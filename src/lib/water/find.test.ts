import { describe, expect, it } from "vitest";
import fixture from "../dams/fixture-rid.json";
import { parseRidDams } from "../dams/rid";
import points from "../../../public/data/river-points.json";
import { filterDams, findWater } from "./find";

const { dams } = parseRidDams(fixture);

describe("water filters and search", () => {
  it("keeps dams by chip", () => {
    expect(filterDams(dams, "all", {})).toHaveLength(dams.length);
    expect(filterDams(dams, "full", {}).every((dam) => dam.storagePct > 80)).toBe(true);
    expect(filterDams(dams, "release", {}).every((dam) => dam.highRelease)).toBe(true);
    expect(filterDams(dams, "watched", { "dam:200101": { value: 64.2, unit: "pct", date: "2026-09-29" } }).map((dam) => dam.id)).toEqual(["200101"]);
  });

  it("finds dams and rivers by Thai or English name, name starts first", () => {
    expect(findWater("ภูมิ", dams, points.points, "th")[0]).toEqual({ kind: "dam", id: "200101", name: "ภูมิพล" });
    expect(findWater("เขื่อนภูมิพล", dams, points.points, "th")[0].id).toBe("200101");
    expect(findWater("bhumibol", dams, points.points, "en")[0].name).toBe("Bhumibol");
    const chao = findWater("เจ้าพระยา", dams, points.points, "th");
    expect(chao.every((hit) => hit.kind === "river")).toBe(true);
    expect(chao).toHaveLength(3);
    expect(findWater("  ", dams, points.points, "th")).toEqual([]);
  });
});

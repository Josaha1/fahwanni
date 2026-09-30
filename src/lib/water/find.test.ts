import { describe, expect, it } from "vitest";
import fixture from "../dams/fixture-rid.json";
import { parseRidDams } from "../dams/rid";
import points from "../../../public/data/river-points.json";
import { filterDams, findWater } from "./find";
import { waterRivers } from "./rivers";

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
    expect(findWater("เขื่อนภูมิพล", dams, points.points, "th")[0]).toEqual({ kind: "dam", id: "200101", name: "ภูมิพล" });
    expect(findWater("bhumibol", dams, points.points, "en")[0]).toEqual({ kind: "dam", id: "200101", name: "Bhumibol" });
    const chao = findWater("เจ้าพระยา", dams, points.points, "th");
    expect(chao).toHaveLength(1);
    expect(chao[0]).toMatchObject({ kind: "riverGroup", river: { id: "chaophraya" } });
    expect(findWater("เชียงใหม่", dams, points.points, "th")[0]).toEqual({ kind: "river", id: "ping-chiangmai", name: "ปิง เชียงใหม่" });
  });

  it("finds Mae Klong and its dams in Thai and English", () => {
    for (const [query, locale] of [["แม่น้ำแม่กลอง", "th"], ["Mae Klong River", "en"], ["  The   Mae Klong River  ", "en"], ["River Mae Klong", "en"], ["Mae Klong the", "en"], ["ลำน้ำแม่กลอง", "th"], ["น้ำ แม่กลอง", "th"]] as const) {
      expect(findWater(query, dams, points.points, locale)).toEqual([expect.objectContaining({
        kind: "riverGroup", river: expect.objectContaining({ id: "maeklong" }),
        points: [], dams: ["200401", "200402"], noPointReason: "dam-controlled",
      })]);
    }
  });

  it("finds three Chao Phraya points and four dams without duplicate direct hits", () => {
    expect(findWater("แม่น้ำเจ้าพระยา", dams, points.points, "th")).toEqual([expect.objectContaining({
      kind: "riverGroup", river: expect.objectContaining({ id: "chaophraya" }),
      points: ["chaophraya-nakhonsawan", "chaophraya-chainat", "chaophraya-ayutthaya"],
      dams: ["200101", "200102", "100107", "100301"],
    })]);
  });

  it("keeps direct dam hits including Khwae Noi alongside its river alias", () => {
    expect(findWater("ภูมิพล", dams, points.points, "th")[0]).toEqual({ kind: "dam", id: "200101", name: "ภูมิพล" });
    const hits = findWater("แควน้อย", dams, points.points, "th");
    expect(hits).toContainEqual(expect.objectContaining({ kind: "riverGroup", river: expect.objectContaining({ id: "maeklong" }) }));
    expect(hits).toContainEqual({ kind: "dam", id: "100107", name: "แควน้อยบำรุงแดน" });
  });

  it("uses only Suphan aliases for Tha Chin and preserves whole Thai dam names", () => {
    expect(waterRivers.find((river) => river.id === "thachin")?.aliases).toEqual(["สุพรรณ", "Suphan"]);
    for (const query of ["แม่น้ำสุพรรณ", "Suphan River"]) {
      expect(findWater(query, dams, points.points, "th")[0]).toMatchObject({ kind: "riverGroup", river: { id: "thachin" }, dams: ["100303"] });
    }
    expect(findWater("สุพรรณบุรี", dams, points.points, "th")).toEqual([]);
    expect(findWater("น้ำอูน", dams, points.points, "th")[0]).toMatchObject({ kind: "dam", id: "100202" });
  });

  it("limits each group list separately and resolves only available points and dams", () => {
    expect(findWater("เจ้าพระยา", dams, points.points, "th", 2)[0]).toMatchObject({
      kind: "riverGroup", points: ["chaophraya-nakhonsawan", "chaophraya-chainat"], dams: ["200101", "200102"],
    });
    expect(findWater("แม่กลอง", dams.filter((dam) => dam.id === "200401"), [], "th")[0]).toMatchObject({
      kind: "riverGroup", points: [], dams: ["200401"],
    });
  });

  it("returns no hits for empty, prefix-only or unknown queries", () => {
    expect(findWater("  ", dams, points.points, "th")).toEqual([]);
    expect(findWater("", dams, points.points, "th")).toEqual([]);
    expect(findWater("แม่น้ำ", dams, points.points, "th")).toEqual([]);
    expect(findWater("the river", dams, points.points, "en")).toEqual([]);
    expect(findWater("unknown river", dams, points.points, "en")).toEqual([]);
  });
});

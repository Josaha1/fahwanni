import { describe, expect, it } from "vitest";
import { provinces, searchProvinces } from "./provinces";

describe("provinces", () => {
  it("contains 77 distinct provinces with capital coordinates in Thailand", () => {
    expect(provinces).toHaveLength(77);
    expect(new Set(provinces.map((p) => p.id)).size).toBe(77);
    for (const p of provinces) {
      expect(p.lat).toBeGreaterThanOrEqual(5.5);
      expect(p.lat).toBeLessThanOrEqual(20.5);
      expect(p.lon).toBeGreaterThanOrEqual(97.3);
      expect(p.lon).toBeLessThanOrEqual(105.7);
    }
  });

  it("searches Thai and English names and strips the จังหวัด prefix", () => {
    expect(searchProvinces("เชียง").map((p) => p.name)).toEqual(expect.arrayContaining(["เชียงใหม่", "เชียงราย"]));
    expect(searchProvinces("เชียงใหม่")[0].id).toBe("chiang-mai");
    expect(searchProvinces("chiang mai")[0].id).toBe("chiang-mai");
    expect(searchProvinces("จังหวัดเชียงใหม่")[0].id).toBe("chiang-mai");
    expect(searchProvinces("กรุงเทพ")[0].id).toBe("bangkok");
    expect(searchProvinces("BANGKOK")[0].id).toBe("bangkok");
    expect(searchProvinces("  ")).toEqual([]);
  });

  it("ranks prefix matches before substring matches and respects the limit", () => {
    expect(searchProvinces("บุรี", 2).map((p) => p.id)).toEqual(["buri-ram", "kanchanaburi"]);
  });
});

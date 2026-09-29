import { describe, expect, it } from "vitest";
import { provinces } from "../provinces";
import fixture from "./fixture-rid.json";
import { DAM_REGISTRY } from "./registry";

describe("dam registry", () => {
  it("has one entry per RID large dam, with a known province and a point inside Thailand", () => {
    const ridIds = fixture.data.flatMap((group) => group.dam.map((dam) => dam.id)).sort();
    expect(DAM_REGISTRY.map((dam) => dam.id).sort()).toEqual(ridIds);
    for (const dam of DAM_REGISTRY) {
      expect(provinces.some((p) => p.id === dam.provinceId), dam.id).toBe(true);
      expect(dam.lat).toBeGreaterThan(5.5); expect(dam.lat).toBeLessThan(20.5);
      expect(dam.lon).toBeGreaterThan(97.3); expect(dam.lon).toBeLessThan(105.7);
      expect(dam.nameEn).not.toBe("");
    }
  });
});

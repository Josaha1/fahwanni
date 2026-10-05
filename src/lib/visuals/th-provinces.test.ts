import { expect, it } from "vitest";
import { provinces } from "@/lib/provinces";
import { thAttribution, thProvinces, thViewBox } from "./th-provinces";

it("contains 77 distinct, nonempty province paths within the viewBox", () => {
  expect(thProvinces.map((entry) => entry.id).sort()).toEqual(provinces.map((entry) => entry.id).sort());
  const [x, y, width, height] = thViewBox.split(" ").map(Number);
  for (const province of thProvinces) {
    expect(province.d).toMatch(/^M[\d.,LZM]+Z$/);
    expect(province.cx).toBeGreaterThanOrEqual(x); expect(province.cx).toBeLessThanOrEqual(x + width);
    expect(province.cy).toBeGreaterThanOrEqual(y); expect(province.cy).toBeLessThanOrEqual(y + height);
    for (const pair of province.d.matchAll(/(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/g)) {
      expect(Number(pair[1])).toBeLessThanOrEqual(x + width);
      expect(Number(pair[2])).toBeLessThanOrEqual(y + height);
    }
  }
  expect(thAttribution).toBe("geoBoundaries / © OpenStreetMap contributors (ODbL)");
});

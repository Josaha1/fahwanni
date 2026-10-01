import { describe, expect, it } from "vitest";
import { parseRiskBbox, parseRiskFeatures } from "./flood-risk";

describe("flood risk", () => {
  it("snaps a bbox outward to the 0.25° grid and rejects bad or huge boxes", () => {
    expect(parseRiskBbox("100.41,13.61,100.69,13.79")).toEqual([100.25, 13.5, 100.75, 14]);
    expect(parseRiskBbox("100,13,103,14")).toBeNull();
    expect(parseRiskBbox("139,35,139.5,35.5")).toBeNull();
    expect(parseRiskBbox("a,b,c,d")).toBeNull();
    expect(parseRiskBbox(null)).toBeNull();
  });

  it("keeps levels 2–4 with village names and drops none/low", () => {
    const points = parseRiskFeatures({ features: [
      { geometry: { coordinates: [100.597183, 13.600413] }, properties: { village_co: 11010150, risk_level: 0, mname: "ชุมชนแสนสุข" } },
      { geometry: { coordinates: [100.5, 14.35] }, properties: { village_co: 14010101, risk_level: 4, mname: " บ้านริมน้ำ ", tname: "ประตูชัย", aname: "พระนครศรีอยุธยา", pname: "พระนครศรีอยุธยา" } },
      { geometry: { coordinates: [100.6, 14.4] }, properties: { village_co: 14010102, risk_level: 1 } },
    ] });
    expect(points).toEqual([{ id: "ddpm:14010101", lat: 14.35, lon: 100.5, level: 4, village: "บ้านริมน้ำ", tambon: "ประตูชัย", amphoe: "พระนครศรีอยุธยา", province: "พระนครศรีอยุธยา" }]);
  });
});

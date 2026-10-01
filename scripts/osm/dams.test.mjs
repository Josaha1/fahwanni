import { describe, expect, it } from "vitest";
import { damsFromOverpass, registryPoints, withoutKnown } from "./dams.mjs";

describe("OSM dams", () => {
  it("takes way centres, prefers Thai names and keeps Latin names only as English", () => {
    const dams = damsFromOverpass({ elements: [
      { type: "way", id: 1, center: { lat: 13.9547928, lon: 99.6250102 }, tags: { name: "เขื่อนทดน้ำเขื่อนแม่กลอง", "name:en": "Mae Klong Dam barrage" } },
      { type: "node", id: 2, lat: 14, lon: 100, tags: { name: "Tiger cave dam" } },
      { type: "way", id: 3, tags: {} },
    ] });
    expect(dams).toEqual([
      { id: "way/1", nameTh: "เขื่อนทดน้ำเขื่อนแม่กลอง", nameEn: "Mae Klong Dam barrage", lat: 13.95479, lon: 99.62501 },
      { id: "node/2", nameTh: "Tiger cave dam", nameEn: "Tiger cave dam", lat: 14, lon: 100 },
    ]);
  });

  it("drops the RID dam itself but keeps a different named dam nearby and unnamed ones farther than 1 km", () => {
    const known = [{ nameTh: "ศรีนครินทร์", lat: 14.4088, lon: 99.1284 }];
    const dams = [
      { id: "a", nameTh: "เขื่อนศรีนครินทร์", nameEn: "", lat: 14.4089, lon: 99.1283 },
      { id: "b", nameTh: "เขื่อนท่าทุ่งนา", nameEn: "", lat: 14.42, lon: 99.13 },
      { id: "c", nameTh: "", nameEn: "", lat: 14.4095, lon: 99.129 },
      { id: "d", nameTh: "", nameEn: "", lat: 14.6, lon: 99.3 },
    ];
    expect(withoutKnown(dams, known).map((dam) => dam.id)).toEqual(["b", "d"]);
  });

  it("parses the 35 RID dams from registry.ts", async () => {
    const { readFile } = await import("node:fs/promises");
    const points = registryPoints(await readFile(new URL("../../src/lib/dams/registry.ts", import.meta.url), "utf8"));
    expect(points).toHaveLength(35);
    expect(points[0]).toEqual({ nameTh: "แม่กวงอุดมธารา", lat: 18.9267, lon: 99.1254 });
  });
});

import { describe, expect, it } from "vitest";
import { translator } from "../../i18n/core";
import type { Storm } from "./normalize";
import { bearingWord, gdacsLevelLabel, stormCategoryLabel, stormMessage } from "./present";

const th = translator("th");
const en = translator("en");
const storm: Storm = { id: "1", source: "jma", name: "Mali", category: "TY", position: { lat: 1, lon: 0 }, track: [], forecast: [] };
const place = { lat: 0, lon: 0, name: "กรุงเทพมหานคร" };

describe("storm presentation", () => {
  it.each([
    ["TY", "พายุไต้ฝุ่น", "Typhoon"],
    ["STS", "พายุโซนร้อนกำลังแรง", "Severe tropical storm"],
    ["TS", "พายุโซนร้อน", "Tropical storm"],
    ["TD", "พายุดีเปรสชัน", "Tropical depression"],
  ])("labels category %s in Thai and English", (category, thai, english) => {
    expect(stormCategoryLabel({ ...storm, category }, th)).toBe(thai);
    expect(stormCategoryLabel({ ...storm, category }, en)).toBe(english);
  });

  it.each([
    ["Red", "ระดับเตือน สูง", "High alert"],
    ["Orange", "ระดับเตือน กลาง", "Moderate alert"],
    ["Green", "ระดับเตือน ต่ำ", "Low alert"],
  ] as const)("labels GDACS %s", (level, thai, english) => {
    expect(gdacsLevelLabel(level, th)).toBe(thai);
    expect(gdacsLevelLabel(level, en)).toBe(english);
  });

  it("uses eight bearing points including the wraparound", () => {
    expect(bearingWord(0, th)).toBe("เหนือ");
    expect(bearingWord(45, en)).toBe("northeast");
    expect(bearingWord(359, en)).toBe("north");
  });

  it("builds Thai and English distance messages from the selected place", () => {
    expect(stormMessage(storm, place, th)).toBe("พายุไต้ฝุ่น Mali อยู่ห่าง ~111 กม. ทางทิศเหนือ ของกรุงเทพมหานคร");
    expect(stormMessage(storm, { ...place, name: "Bangkok" }, en)).toBe("Typhoon Mali is ~111 km north of Bangkok");
  });
});

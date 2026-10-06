import { describe, expect, it } from "vitest";
import { provinces } from "@/lib/provinces";
import { provinceWarnings, riskBoxes } from "./data";

const ayutthaya = provinces.find((p) => p.id === "phra-nakhon-si-ayutthaya")!;
const chiangMai = provinces.find((p) => p.id === "chiang-mai")!;

describe("provinceWarnings", () => {
  it("matches the province by name, its region, or a nationwide warning", () => {
    const items = [
      { title: "ฝนตกหนัก", description: "พระนครศรีอยุธยา" },
      { title: "ฝนตกหนัก", description: "ภาคกลาง" },
      { title: "คลื่นลมแรง", description: "ทั่วประเทศ" },
      { title: "ฝนตกหนัก", description: "ภาคเหนือ" },
    ];
    expect(provinceWarnings(items, ayutthaya).map((item) => item.description)).toEqual(["พระนครศรีอยุธยา", "ภาคกลาง", "ทั่วประเทศ"]);
    expect(provinceWarnings(items, chiangMai).map((item) => item.description)).toEqual(["ทั่วประเทศ", "ภาคเหนือ"]);
  });
});

describe("riskBoxes", () => {
  it("covers the bbox on the quarter-degree grid in boxes no larger than 1.5°", () => {
    const boxes = riskBoxes([99.9, 13.9, 102.1, 15.2]);
    for (const [w, s, e, n] of boxes) { expect(e - w).toBeLessThanOrEqual(1.5); expect(n - s).toBeLessThanOrEqual(1.5); }
    expect(Math.min(...boxes.map((b) => b[0]))).toBeLessThanOrEqual(99.9);
    expect(Math.max(...boxes.map((b) => b[2]))).toBeGreaterThanOrEqual(102.1);
    expect(Math.max(...boxes.map((b) => b[3]))).toBeGreaterThanOrEqual(15.2);
  });
});

import { describe, expect, it } from "vitest";
import { translator } from "../i18n/core";
import { heatBandWord, humidityWord, pm25LevelWord, uvWord, windWord } from "./words";

const th = translator("th");
const en = translator("en");

describe("weather words", () => {
  it.each([
    ["none", "ปกติ", "Normal"], ["caution", "เฝ้าระวัง", "Caution"],
    ["warning", "เตือนภัย", "Warning"], ["danger", "อันตราย", "Danger"],
    ["extreme", "อันตรายมาก", "Extreme danger"],
  ] as const)("labels heat band %s", (band, thai, english) => {
    expect(heatBandWord(band, th)).toBe(thai);
    expect(heatBandWord(band, en)).toBe(english);
  });

  it.each([
    ["good", "ดี", "Good"], ["moderate", "ปานกลาง", "Moderate"],
    ["sensitive", "เริ่มมีผลต่อสุขภาพ", "Unhealthy for sensitive groups"],
    ["unhealthy", "มีผลต่อสุขภาพ", "Unhealthy"],
    ["very-unhealthy", "มีผลต่อสุขภาพมาก", "Very unhealthy"],
  ] as const)("labels PM2.5 level %s", (level, thai, english) => {
    expect(pm25LevelWord(level, th)).toBe(thai);
    expect(pm25LevelWord(level, en)).toBe(english);
  });

  it.each([
    [0, "ต่ำ"], [2, "ต่ำ"], [3, "ปานกลาง"], [5, "ปานกลาง"],
    [6, "สูง"], [7, "สูง"], [8, "สูงมาก"], [10, "สูงมาก"], [11, "อันตราย"],
  ])("maps UV %s to %s", (value, word) => expect(uvWord(value, th)).toBe(word));

  it.each([
    [0, "ลมสงบ"], [5.9, "ลมสงบ"], [6, "ลมอ่อน"], [19.9, "ลมอ่อน"],
    [20, "ลมปานกลาง"], [38.9, "ลมปานกลาง"], [39, "ลมแรง"],
    [61.9, "ลมแรง"], [62, "ลมแรงมาก"],
  ])("maps wind %s km/h to %s", (value, word) => expect(windWord(value, th)).toBe(word));

  it.each([
    [0, "แห้ง"], [39.9, "แห้ง"], [40, "สบาย"], [69.9, "สบาย"],
    [70, "ชื้น"], [84.9, "ชื้น"], [85, "ชื้นมาก"],
  ])("maps humidity %s%% to %s", (value, word) => expect(humidityWord(value, th)).toBe(word));

  it("translates numeric bucket labels", () => {
    expect(uvWord(11, en)).toBe("Danger");
    expect(windWord(62, en)).toBe("Very strong wind");
    expect(humidityWord(85, en)).toBe("Very humid");
  });
});

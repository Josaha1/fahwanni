import { describe, expect, it } from "vitest";
import { translator } from "../../i18n/core";
import { PM25_COLORS, RAIN_RAMP, TEMP_STOPS } from "./palette";
import { legendFor, legendGradient } from "./legend";

describe("legendFor", () => {
  it("describes rain with radar colours, Thai keys, and numeric rates", () => {
    expect(legendFor("rain")).toEqual({ title: "ฝน", unit: "มม./ชม.", steps: [
      { color: RAIN_RAMP[1], label: "ฝนเบา", value: "0.3–1" },
      { color: RAIN_RAMP[2], label: "ฝนปานกลาง", value: "1–4" },
      { color: RAIN_RAMP[3], label: "ฝนหนัก", value: "4–10" },
      { color: RAIN_RAMP[4], label: "ฝนหนักมาก", value: "10+" },
    ] });
  });

  it("describes temperature at all stops", () => {
    expect(legendFor("temp")).toEqual({ title: "อุณหภูมิ", unit: "°C", steps: [
      { color: TEMP_STOPS[0][1], label: "หนาว", value: "≤15" },
      { color: TEMP_STOPS[1][1], label: "เย็น", value: "20" },
      { color: TEMP_STOPS[2][1], label: "สบาย", value: "25" },
      { color: TEMP_STOPS[3][1], label: "อบอุ่น", value: "30" },
      { color: TEMP_STOPS[4][1], label: "ร้อน", value: "35" },
      { color: TEMP_STOPS[5][1], label: "ร้อนจัด", value: "40+" },
    ] });
  });

  it("describes PM2.5 with the existing threshold ranges and CAMS note", () => {
    expect(legendFor("pm25")).toEqual({ title: "ฝุ่น PM2.5", unit: "µg/m³", note: "ค่าประมาณจากแบบจำลอง (CAMS)", steps: [
      { color: PM25_COLORS["very-good"], label: "ดีมาก", value: "0–15" },
      { color: PM25_COLORS.good, label: "ดี", value: "15–25" },
      { color: PM25_COLORS.moderate, label: "ปานกลาง", value: "25–37.5" },
      { color: PM25_COLORS["starting-to-affect"], label: "เริ่มมีผลต่อสุขภาพ", value: "37.5–75" },
      { color: PM25_COLORS["affects-health"], label: "มีผลต่อสุขภาพ", value: "75+" },
    ] });
  });

  it.each(["rain", "temp", "pm25"] as const)("builds a CSS gradient for %s", (primary) => {
    expect(legendGradient(primary)).toBe(`linear-gradient(to right, ${legendFor(primary).steps.map((step) => step.color).join(", ")})`);
  });

  it("has English translations for every Thai legend key", () => {
    const en = translator("en");
    for (const primary of ["rain", "temp", "pm25"] as const) {
      const { title, unit, note, steps } = legendFor(primary);
      for (const key of [title, unit, note, ...steps.map((step) => step.label)]) {
        if (key && /[\u0e00-\u0e7f]/.test(key)) expect(en(key)).not.toBe(key);
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import { translator } from "../i18n/core";
import type { Advice } from "./advise";
import { adviceText } from "./advice-text";

describe("adviceText", () => {
  it.each([
    "umbrella", "storm", "heat", "uv", "wind", "cooler", "sticky", "rain-start",
    "commute-rain", "laundry-ok", "laundry-no", "exercise-ok", "exercise-no", "flood", "pm25",
  ])("renders %s in Thai and English", (id) => {
    const advice: Advice = { id, severity: "tip", params: { hour: "15:00", band: "warning" } };
    const thai = adviceText(advice, translator("th"));
    const english = adviceText(advice, translator("en"));
    expect(thai).toMatch(/[ก-๙]/);
    expect(english).not.toMatch(/[ก-๙]|\{hour\}/);
  });

  it("uses the forecast hour and risk band", () => {
    const t = translator("th");
    expect(adviceText({ id: "rain-start", severity: "tip", params: { hour: "15:00" } }, t))
      .toBe("ฝนน่าจะเริ่มตกราว 15:00 น.");
    expect(adviceText({ id: "heat", severity: "warn", params: { band: "extreme" } }, t))
      .toContain("อันตรายมาก");
    expect(adviceText({ id: "pm25", severity: "warn", params: { band: "unhealthy" } }, t))
      .toBe("ฝุ่น PM2.5 เกินมาตรฐาน ใส่หน้ากาก N95");
  });
});

import { describe, expect, it } from "vitest";
import { riverColors } from "../rivers/colors";
import { translator } from "../../i18n/core";
import { damBandColor } from "../dams/bands";
import { probabilityRgba } from "../precip/render";
import { cloudRgba, DATA, heatColor, PM25_COLORS, RAIN_RAMP, TEMP_STOPS, windColor } from "./palette";
import { damLegendStrip, legendFor, legendGradient, overlayLegend } from "./legend";

const cssColor = (probability: number) => {
  const [r, g, b, a] = probabilityRgba(probability);
  return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
};

describe("legendFor", () => {
  it("explains infrared cloud tops and the satellite rain overlay", () => {
    const satellite = legendFor("satellite");
    expect(satellite.title).toBe("ภาพดาวเทียมอินฟราเรด (Himawari · NASA GIBS)");
    expect(satellite.note).toContain("ยอดเมฆเย็นจัด");
    const imerg = overlayLegend({ wind: false, storms: false, quakes: false, dams: false, imerg: true }).at(-1)!;
    expect(imerg).toMatchObject({ title: "ฝนจากดาวเทียม (IMERG)", note: "ล่าช้า ~6 ชม." });
    const en = translator("en");
    for (const key of [satellite.title, satellite.note!, ...satellite.steps.map((step) => step.label), imerg.title, imerg.note!, imerg.rows[0].label]) {
      expect(en(key)).not.toBe(key);
    }
  });
  it("describes rain with radar colours, Thai keys, and numeric rates", () => {
    expect(legendFor("rain")).toEqual({ title: "ฝน", unit: "มม./ชม.", steps: [
      { color: RAIN_RAMP[1], label: "ฝนเบา", value: "0.3–1" },
      { color: RAIN_RAMP[2], label: "ฝนปานกลาง", value: "1–4" },
      { color: RAIN_RAMP[3], label: "ฝนหนัก", value: "4–10" },
      { color: RAIN_RAMP[4], label: "ฝนหนักมาก", value: "10+" },
    ] });
  });

  it("describes forecast intensity and probability with the model note", () => {
    const note = "พยากรณ์จากแบบจำลอง ~100 กม. · ไม่ใช่เรดาร์";
    expect(legendFor("rain", "blend")).toEqual({ ...legendFor("rain"), note });
    expect(legendFor("rain", "intensity")).toEqual({ ...legendFor("rain"), note });
    const probability = legendFor("rain", "probability");
    expect(probability).toEqual({ title: "โอกาสฝน", unit: "%", note, steps: [
      { color: cssColor(40), label: "มีโอกาส", value: "40–60" },
      { color: cssColor(60), label: "ค่อนข้างมาก", value: "60–80" },
      { color: cssColor(80), label: "สูง", value: "80+" },
    ] });
    expect(legendGradient("rain", "probability"))
      .toBe(`linear-gradient(to right, ${probability.steps.map((step) => step.color).join(", ")})`);
    const en = translator("en");
    for (const key of [probability.title, probability.note, ...probability.steps.map((step) => step.label)]) {
      if (!key) continue;
      expect(en(key)).not.toBe(key);
    }
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

describe("overlayLegend", () => {
  it("always includes the location symbols and only requested overlay sections", () => {
    expect(overlayLegend({ wind: false, storms: false, quakes: false, dams: false })).toEqual([{ title: "สัญลักษณ์", rows: [
      { swatch: { kind: "pin" }, label: "ตำแหน่งของคุณ" },
      { swatch: { kind: "probe" }, label: "จุดที่แตะดูอากาศ" },
    ] }]);
    const all = overlayLegend({ wind: true, storms: true, quakes: true, dams: false });
    expect(all.map((section) => section.title)).toEqual(["สัญลักษณ์", "ลม", "พายุ", "แผ่นดินไหว"]);
    expect(all[1].rows.map((row) => row.swatch)).toEqual([1, 5, 10, 16].map((speed) => ({ kind: "line", color: windColor(speed) })));
    expect(all[2].rows.map((row) => row.swatch)).toEqual([
      { kind: "line", color: DATA.storm },
      { kind: "line", color: DATA.storm, dashed: true },
      { kind: "fill", color: DATA.storm, opacity: 0.12 },
    ]);
    expect(all[3].rows.map((row) => row.swatch)).toEqual([
      { kind: "circle", color: DATA.quake, size: 10 },
      { kind: "circle", color: DATA.quake, size: 20 },
    ]);
    expect(overlayLegend({ wind: false, storms: true, quakes: false, dams: false }).map((section) => section.title)).toEqual(["สัญลักษณ์", "พายุ"]);
    expect(overlayLegend({ wind: false, storms: false, quakes: false, dams: false, favourites: true })[0].rows.at(-1)).toEqual({
      swatch: { kind: "favourite" }, label: "สถานที่ที่บันทึกไว้",
    });
  });

  it("describes dam bands, the release marker and the downstream path", () => {
    const sections = overlayLegend({ wind: false, storms: false, quakes: false, dams: true });
    expect(sections.map((section) => section.title)).toEqual(["สัญลักษณ์", "เขื่อน (% ความจุ)"]);
    expect(sections[1].rows).toEqual([
      { swatch: { kind: "circle", color: damBandColor(1), size: 12 }, label: "≤30% น้ำน้อยวิกฤต" },
      { swatch: { kind: "circle", color: damBandColor(2), size: 12 }, label: "31–50% น้ำน้อย" },
      { swatch: { kind: "circle", color: damBandColor(3), size: 12 }, label: "51–80% ปานกลาง" },
      { swatch: { kind: "circle", color: damBandColor(4), size: 12 }, label: "81–100% น้ำมาก" },
      { swatch: { kind: "circle", color: damBandColor(5), size: 12 }, label: "เกิน 100% เกินความจุ" },
      { swatch: { kind: "ring", color: "#e5484d" }, label: "ระบายน้ำมาก" },
      { swatch: { kind: "line", color: "#2563eb" }, label: "แนวลำน้ำท้ายเขื่อน — ไม่ใช่พื้นที่น้ำท่วม" },
      { swatch: { kind: "line", color: "#2563eb", dashed: true }, label: "เส้นประที่เคลื่อนที่ = ทิศทางน้ำไหล (เส้นหนา = ระบายมาก)" },
    ]);
  });

  it("shows TMD 24-hour rainfall categories only when rain risk is ready", () => {
    const base = { wind: false, storms: false, quakes: false, dams: false };
    expect(overlayLegend({ ...base, rainRisk: false })).toHaveLength(1);
    expect(overlayLegend({ ...base, rainRisk: true }).at(-1)).toEqual({ title: "ฝน 24 ชม. (กรมอุตุฯ)", rows: [
      { swatch: { kind: "circle", color: "#a855f7", size: 12 }, label: "ฝนหนัก 35.1–90 มม." },
      { swatch: { kind: "circle", color: "#6b21a8", size: 14 }, label: "ฝนหนักมาก มากกว่า 90 มม." },
    ] });
  });

  it("shows the four modelled river discharge ring statuses only when rivers are ready", () => {
    const base = { wind: false, storms: false, quakes: false, dams: false };
    expect(overlayLegend({ ...base, rivers: false })).toHaveLength(1);
    expect(overlayLegend({ ...base, rivers: true }).at(-1)).toEqual({ title: "ปริมาณน้ำไหลผ่าน (แบบจำลอง)", rows: [
      { swatch: { kind: "ring", color: riverColors.low }, label: "ต่ำกว่าปกติ" },
      { swatch: { kind: "ring", color: riverColors.normal }, label: "ปกติ" },
      { swatch: { kind: "ring", color: riverColors.high }, label: "สูงกว่าปกติ" },
      { swatch: { kind: "ring", color: riverColors.veryHigh }, label: "สูงมาก" },
    ] });
  });

  it("labels the satellite flood pixels and their observation limits", () => {
    const section = overlayLegend({ wind: false, storms: false, quakes: false, dams: false, satFlood: true }).at(-1);
    expect(section).toEqual({ title: "น้ำท่วมจากดาวเทียม (NASA)", note: "ล่าช้า ~1 วัน · ใต้เมฆมองไม่เห็น · ไม่ใช่การพยากรณ์", rows: [
      { swatch: { kind: "fill", color: "#fa1e24", opacity: 0.85 }, label: "บริเวณที่ดาวเทียมเห็นน้ำท่วม" },
    ] });
    const en = translator("en");
    expect(en(section!.title)).not.toBe(section!.title);
    expect(en(section!.note!)).not.toBe(section!.note);
    expect(en(section!.rows[0].label)).not.toBe(section!.rows[0].label);
  });

  it("has English translations for every Thai row and section", () => {
    const en = translator("en");
    for (const section of overlayLegend({ wind: true, storms: true, quakes: true, dams: true, favourites: true, rivers: true })) {
      expect(en(section.title)).not.toBe(section.title);
      for (const row of section.rows) expect(en(row.label)).not.toBe(row.label);
    }
  });

  it("gives the water-mode strip the five dam band colours in order", () => {
    const strip = damLegendStrip();
    expect(strip.steps.map((step) => step.label)).toEqual(["≤30", "31–50", "51–80", "81–100", ">100"]);
    expect(strip.steps.map((step) => step.color)).toEqual([1, 2, 3, 4, 5].map((band) => damBandColor(band as 1 | 2 | 3 | 4 | 5)));
    const en = translator("en");
    expect(en(strip.title)).not.toBe(strip.title);
    expect(en(strip.unit)).not.toBe(strip.unit);
  });
});

describe("heat and cloud layers", () => {
  it("bands heat like the home page advice and fades clouds in above 15 %", () => {
    expect([26, 27, 33, 42, 52, 60].map(heatColor)).toEqual(["#7cc86f", "#f2d24b", "#f0913a", "#d6453d", "#8b1d5a", "#8b1d5a"]);
    expect(cloudRgba(10)).toBeNull();
    expect(cloudRgba(100)![3]).toBe(Math.round(0.75 * 255));
    expect(cloudRgba(57.5)![3]).toBe(Math.round(0.5 * 0.75 * 255));
  });

  it("has legends with English for both new layers", () => {
    const en = translator("en");
    for (const primary of ["heat", "cloud"] as const) {
      const legend = legendFor(primary);
      expect(en(legend.title)).not.toBe(legend.title);
      for (const step of legend.steps) expect(en(step.label)).not.toBe(step.label);
      expect(legend.note && en(legend.note)).not.toBe(legend.note);
    }
  });
});

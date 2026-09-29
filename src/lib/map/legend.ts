import { DATA, PM25_COLORS, RAIN_RAMP, TEMP_STOPS, windColor } from "./palette";
import { damBandColor, damBandWord } from "../dams/bands";
import { probabilityRgba, type RainMode } from "../precip/render";

export type PrimaryLayer = "rain" | "temp" | "pm25";
export type Legend = { title: string; unit: string; note?: string; steps: { color: string; label: string; value: string }[] };
export type Swatch =
  | { kind: "line"; color: string; dashed?: boolean }
  | { kind: "fill"; color: string; opacity: number }
  | { kind: "circle"; color: string; size: number }
  | { kind: "ring"; color: string }
  | { kind: "square"; color: string }
  | { kind: "pin" }
  | { kind: "probe" };
export type OverlayLegend = { title: string; rows: { swatch: Swatch; label: string }[] };

export function overlayLegend(active: { wind: boolean; storms: boolean; quakes: boolean; dams: boolean; rainRisk?: boolean; rainAccum?: boolean }): OverlayLegend[] {
  const sections: OverlayLegend[] = [{ title: "สัญลักษณ์", rows: [
    { swatch: { kind: "pin" }, label: "ตำแหน่งของคุณ" },
    { swatch: { kind: "probe" }, label: "จุดที่แตะดูอากาศ" },
  ] }];
  if (active.wind) sections.push({ title: "ลม", rows: [
    { swatch: { kind: "line", color: windColor(1) }, label: "ลมสงบ–อ่อน (ต่ำกว่า 11 กม./ชม.)" },
    { swatch: { kind: "line", color: windColor(5) }, label: "ลมอ่อน–ปานกลาง (11–29 กม./ชม.)" },
    { swatch: { kind: "line", color: windColor(10) }, label: "ลมแรง (29–50 กม./ชม.)" },
    { swatch: { kind: "line", color: windColor(16) }, label: "ลมแรงมาก (50+ กม./ชม.)" },
  ] });
  if (active.storms) sections.push({ title: "พายุ", rows: [
    { swatch: { kind: "line", color: DATA.storm }, label: "เส้นทางที่ผ่านมา" },
    { swatch: { kind: "line", color: DATA.storm, dashed: true }, label: "เส้นทางคาดการณ์" },
    { swatch: { kind: "fill", color: DATA.storm, opacity: 0.12 }, label: "พื้นที่ที่อาจได้รับผลกระทบ" },
  ] });
  if (active.quakes) sections.push({ title: "แผ่นดินไหว", rows: [
    { swatch: { kind: "circle", color: DATA.quake, size: 10 }, label: "แผ่นดินไหว (วงใหญ่ = รุนแรงกว่า)" },
    { swatch: { kind: "circle", color: DATA.quake, size: 20 }, label: "ขนาด 5 ขึ้นไปมีป้ายบอกขนาด" },
  ] });
  if (active.dams) {
    sections.push({ title: "เขื่อน (% ความจุ)", rows: [
      { swatch: { kind: "circle", color: damBandColor(1), size: 12 }, label: `≤30% ${damBandWord(1)}` },
      { swatch: { kind: "circle", color: damBandColor(2), size: 12 }, label: `31–50% ${damBandWord(2)}` },
      { swatch: { kind: "circle", color: damBandColor(3), size: 12 }, label: `51–80% ${damBandWord(3)}` },
      { swatch: { kind: "circle", color: damBandColor(4), size: 12 }, label: `81–100% ${damBandWord(4)}` },
      { swatch: { kind: "circle", color: damBandColor(5), size: 12 }, label: `เกิน 100% ${damBandWord(5)}` },
      { swatch: { kind: "ring", color: "#e5484d" }, label: "ระบายน้ำมาก" },
      { swatch: { kind: "line", color: "#2563eb" }, label: "แนวลำน้ำท้ายเขื่อน — ไม่ใช่พื้นที่น้ำท่วม" },
      { swatch: { kind: "line", color: "#2563eb", dashed: true }, label: "เส้นประที่เคลื่อนที่ = ทิศทางน้ำไหล (เส้นหนา = ระบายมาก)" },
    ] });
  }
  if (active.rainRisk) sections.push({ title: "ฝน 24 ชม. (กรมอุตุฯ)", rows: [
    { swatch: { kind: "circle", color: "#a855f7", size: 12 }, label: "ฝนหนัก 35.1–90 มม." },
    { swatch: { kind: "circle", color: "#6b21a8", size: 14 }, label: "ฝนหนักมาก มากกว่า 90 มม." },
  ] });
  if (active.rainAccum) sections.push({ title: "ฝนสะสม 3 วัน (แบบจำลอง)", rows: [
    { swatch: { kind: "fill", color: "#f97316", opacity: 110 / 255 }, label: "90–149 มม." },
    { swatch: { kind: "fill", color: "#b91c1c", opacity: 140 / 255 }, label: "150 มม. ขึ้นไป" },
  ] });
  return sections;
}

export function legendFor(primary: PrimaryLayer, rainMode?: RainMode): Legend {
  switch (primary) {
    case "rain": {
      const note = rainMode === undefined ? {} : { note: "พยากรณ์จากแบบจำลอง ~100 กม. · ไม่ใช่เรดาร์" };
      if (rainMode === "probability") return {
        title: "โอกาสฝน", unit: "%", ...note, steps: ([
          [40, "มีโอกาส", "40–60"],
          [60, "ค่อนข้างมาก", "60–80"],
          [80, "สูง", "80+"],
        ] as const).map(([probability, label, value]) => {
          const [r, g, b, a] = probabilityRgba(probability);
          return { color: `rgba(${r}, ${g}, ${b}, ${a / 255})`, label, value };
        }),
      };
      return {
        title: "ฝน", unit: "มม./ชม.", ...note, steps: [
          { color: RAIN_RAMP[1], label: "ฝนเบา", value: "0.3–1" },
          { color: RAIN_RAMP[2], label: "ฝนปานกลาง", value: "1–4" },
          { color: RAIN_RAMP[3], label: "ฝนหนัก", value: "4–10" },
          { color: RAIN_RAMP[4], label: "ฝนหนักมาก", value: "10+" },
        ],
      };
    }
    case "temp": return {
      title: "อุณหภูมิ", unit: "°C", steps: TEMP_STOPS.map(([, color], index) => ({
        color, label: ["หนาว", "เย็น", "สบาย", "อบอุ่น", "ร้อน", "ร้อนจัด"][index],
        value: ["≤15", "20", "25", "30", "35", "40+"][index],
      })),
    };
    case "pm25": return {
      title: "ฝุ่น PM2.5", unit: "µg/m³", note: "ค่าประมาณจากแบบจำลอง (CAMS)", steps: [
        { color: PM25_COLORS["very-good"], label: "ดีมาก", value: "0–15" },
        { color: PM25_COLORS.good, label: "ดี", value: "15–25" },
        { color: PM25_COLORS.moderate, label: "ปานกลาง", value: "25–37.5" },
        { color: PM25_COLORS["starting-to-affect"], label: "เริ่มมีผลต่อสุขภาพ", value: "37.5–75" },
        { color: PM25_COLORS["affects-health"], label: "มีผลต่อสุขภาพ", value: "75+" },
      ],
    };
  }
}

export function legendGradient(primary: PrimaryLayer, rainMode?: RainMode): string {
  return `linear-gradient(to right, ${legendFor(primary, rainMode).steps.map((step) => step.color).join(", ")})`;
}

/** Compact dam-band key for the water-mode sheet strip (the full words live in the legend dialog). */
export function damLegendStrip(): { title: string; unit: string; steps: { color: string; label: string }[] } {
  return { title: "เขื่อน", unit: "% ความจุ", steps: (["≤30", "31–50", "51–80", "81–100", ">100"] as const)
    .map((label, index) => ({ color: damBandColor((index + 1) as 1 | 2 | 3 | 4 | 5), label })) };
}

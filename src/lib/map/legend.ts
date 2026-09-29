import { DATA, PM25_COLORS, RAIN_RAMP, TEMP_STOPS, windColor } from "./palette";
import { damBandColor, damBandWord, stationSituationColor, situationWord } from "../dams/thaiwater";

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

export function overlayLegend(active: { wind: boolean; storms: boolean; quakes: boolean; dams: boolean }): OverlayLegend[] {
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
      { swatch: { kind: "square", color: "#003CFA" }, label: "เขื่อนเจ้าพระยา (ระบายท้ายเขื่อน)" },
      { swatch: { kind: "line", color: "#2563eb" }, label: "แนวลำน้ำท้ายเขื่อน — ไม่ใช่พื้นที่น้ำท่วม" },
    ] });
    sections.push({ title: "ระดับน้ำในลำน้ำ (% ของตลิ่ง)", rows: [
      { swatch: { kind: "circle", color: stationSituationColor(1)!, size: 12 }, label: `≤10% ${situationWord(1)}` },
      { swatch: { kind: "circle", color: stationSituationColor(2)!, size: 12 }, label: `>10% ${situationWord(2)}` },
      { swatch: { kind: "circle", color: stationSituationColor(3)!, size: 12 }, label: `>30% ${situationWord(3)}` },
      { swatch: { kind: "circle", color: stationSituationColor(4)!, size: 12 }, label: `>70% ${situationWord(4)}` },
      { swatch: { kind: "circle", color: stationSituationColor(5)!, size: 12 }, label: `>100% ${situationWord(5)}` },
    ] });
  }
  return sections;
}

export function legendFor(primary: PrimaryLayer): Legend {
  switch (primary) {
    case "rain": return {
      title: "ฝน", unit: "มม./ชม.", steps: [
        { color: RAIN_RAMP[1], label: "ฝนเบา", value: "0.3–1" },
        { color: RAIN_RAMP[2], label: "ฝนปานกลาง", value: "1–4" },
        { color: RAIN_RAMP[3], label: "ฝนหนัก", value: "4–10" },
        { color: RAIN_RAMP[4], label: "ฝนหนักมาก", value: "10+" },
      ],
    };
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

export function legendGradient(primary: PrimaryLayer): string {
  return `linear-gradient(to right, ${legendFor(primary).steps.map((step) => step.color).join(", ")})`;
}

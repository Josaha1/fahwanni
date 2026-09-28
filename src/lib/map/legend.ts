import { PM25_COLORS, RAIN_RAMP, TEMP_STOPS } from "./palette";

export type PrimaryLayer = "rain" | "temp" | "pm25";
export type Legend = { title: string; unit: string; note?: string; steps: { color: string; label: string; value: string }[] };

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

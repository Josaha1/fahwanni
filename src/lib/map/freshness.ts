export type FreshnessInput = {
  radarTime?: string | null; modelFetchedAt?: number | null; damsDate?: string | null; rainObservedAt?: string | null;
  riversDate?: string | null;
  satFloodDate?: string | null;
  /** undefined: warnings not loaded; null: loaded and there is none right now. */
  warningAt?: string | null;
};
export type FreshnessRow = { key: string; label: string; source: string; time: number | null; daily: boolean; none?: boolean };

const day = (date: string | null | undefined) => date ? Date.parse(`${date}T07:00:00+07:00`) : null;
const at = (iso: string | null | undefined) => {
  const time = iso ? Date.parse(iso.includes("T") || iso.includes("+") ? iso : iso.replace(" ", "T") + "+07:00") : NaN;
  return Number.isFinite(time) ? time : null;
};

/** One row per source, in the order people ask about them; `daily` sources publish once a day. */
export function freshnessRows(input: FreshnessInput): FreshnessRow[] {
  return [
    { key: "radar", label: "เรดาร์ฝน", source: "RainViewer", time: at(input.radarTime), daily: false },
    { key: "model", label: "แบบจำลองพยากรณ์ (ลม ฝน อุณหภูมิ เมฆ)", source: "Open-Meteo", time: input.modelFetchedAt ?? null, daily: false },
    { key: "dams", label: "ปริมาณน้ำในเขื่อน", source: "กรมชลประทาน", time: day(input.damsDate), daily: true },
    { key: "rain", label: "ฝน 24 ชม. จากสถานี", source: "กรมอุตุนิยมวิทยา", time: at(input.rainObservedAt), daily: true },
    { key: "rivers", label: "ปริมาณน้ำไหลผ่าน (แบบจำลอง)", source: "GloFAS / Open-Meteo", time: day(input.riversDate), daily: true },
    ...(input.satFloodDate ? [{ key: "sat-flood", label: "น้ำท่วมจากดาวเทียม", source: "NASA LANCE / GIBS", time: Date.parse(`${input.satFloodDate}T00:00:00Z`), daily: true }] : []),
    { key: "warnings", label: "ประกาศเตือนภัยล่าสุด", source: "กรมอุตุนิยมวิทยา", time: at(input.warningAt), daily: false, none: input.warningAt === null },
  ];
}

/** Age in whole minutes, or null when unknown. */
export function ageMinutes(time: number | null, nowMs: number): number | null {
  return time === null ? null : Math.max(0, Math.round((nowMs - time) / 60_000));
}

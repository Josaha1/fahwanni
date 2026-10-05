export type FreshnessInput = {
  radarTime?: string | null; modelFetchedAt?: number | null; damsDate?: string | null; rainObservedAt?: string | null;
  riversDate?: string | null;
  satFloodDate?: string | null; thermalDate?: string | null;
  himawariTime?: string | null; imergTime?: string | null;
  /** undefined: warnings not loaded; null: loaded and there is none right now. */
  warningAt?: string | null;
};
export type FreshnessRow = { key: string; label: string; source: string; time: number | null; daily: boolean; none?: boolean };

export type FreshnessKind = "daily" | "rain24h" | "satellite" | "monthly" | "model";

/** Date-only reports and timestamps without an offset use the publishing agency's Thai timezone. */
export function sourceTimeMs(dateOrIso: string | Date | number | null | undefined): number | null {
  if (dateOrIso === null || dateOrIso === undefined || dateOrIso === "") return null;
  let time: number;
  if (typeof dateOrIso === "number") time = dateOrIso;
  else if (dateOrIso instanceof Date) time = dateOrIso.getTime();
  else {
    const iso = dateOrIso.trim().replace(" ", "T");
    time = Date.parse(/^\d{4}-\d{2}$/.test(iso) ? `${iso}-01T00:00:00+07:00`
      : /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00+07:00`
        : /T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(iso) ? `${iso}+07:00` : iso);
  }
  return Number.isFinite(time) ? time : null;
}

export function staleness(dateOrIso: string | Date | number | null | undefined, kind: FreshnessKind, nowMs: number): "fresh" | "yesterday" | "old" {
  const time = sourceTimeMs(dateOrIso);
  if (time === null || kind === "monthly" || kind === "model") return "fresh";
  const age = nowMs - time;
  const hour = 3_600_000;
  if (kind === "daily") return age > 48 * hour ? "old" : age > 24 * hour ? "yesterday" : "fresh";
  return age > (kind === "rain24h" ? 36 : 72) * hour ? "old" : "fresh";
}

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
    ...(input.thermalDate ? [{ key: "thermal", label: "จุดความร้อน (ไฟ)", source: "NASA FIRMS/GIBS", time: Date.parse(`${input.thermalDate}T00:00:00Z`), daily: true }] : []),
    ...(input.himawariTime !== undefined ? [{ key: "himawari", label: "ภาพดาวเทียมอินฟราเรด", source: "Himawari (JMA) via NASA GIBS", time: at(input.himawariTime), daily: false }] : []),
    ...(input.imergTime !== undefined ? [{ key: "imerg", label: "ฝนจากดาวเทียม", source: "IMERG (NASA GPM)", time: at(input.imergTime), daily: false }] : []),
    { key: "warnings", label: "ประกาศเตือนภัยล่าสุด", source: "กรมอุตุนิยมวิทยา", time: at(input.warningAt), daily: false, none: input.warningAt === null },
  ];
}

/** Age in whole minutes, or null when unknown. */
export function ageMinutes(time: number | null, nowMs: number): number | null {
  return time === null ? null : Math.max(0, Math.round((nowMs - time) / 60_000));
}

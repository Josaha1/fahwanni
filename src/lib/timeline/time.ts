import { TZDate } from "@date-fns/tz";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const ZONE = "Asia/Bangkok";
const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."] as const;
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."] as const;

export interface TimeDomain {
  start: number;
  now: number;
  end: number;
}

// ตาม docs ของ Open-Meteo ค่า 15 นาทีนอก Central Europe / North America เป็นการ interpolate จากรายชั่วโมง — Claude ตรวจ 2026-09-29: API ตอบค่าให้กรุงเทพฯ แต่ไม่มีข้อมูลเพิ่ม
export function makeDomain(nowMs: number, { pastMin = 60, days = 7 }: { pastMin?: number; days?: number } = {}): TimeDomain {
  const local = new TZDate(nowMs, ZONE);
  return {
    start: Math.floor((nowMs - pastMin * MINUTE) / (10 * MINUTE)) * 10 * MINUTE,
    now: nowMs,
    end: new TZDate(local.getFullYear(), local.getMonth(), local.getDate() + days, ZONE).getTime(),
  };
}

export function roundTo(t: number, stepMs: number): number {
  return Math.round(t / stepMs) * stepMs;
}

export function clampToDomain(t: number, d: TimeDomain): number {
  return Math.max(d.start, Math.min(t, d.end));
}

export function snapStep(t: number, d: TimeDomain): number {
  return clampToDomain(roundTo(t, t <= d.now ? 10 * MINUTE : MINUTE), d);
}

/** Times are sorted ascending; an exact match belongs to that time's lower bracket. */
export function bracket(t: number, times: number[]): { i: number; f: number } | null {
  if (!times.length) return null;
  let low = 0, high = times.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (times[middle] <= t) low = middle + 1;
    else high = middle;
  }
  const i = Math.max(0, low - 1);
  if (i === times.length - 1 || t <= times[i]) return { i, f: 0 };
  return { i, f: (t - times[i]) / (times[i + 1] - times[i]) };
}

export function lerpGrid(a: ArrayLike<number>, b: ArrayLike<number>, f: number, out: Float32Array = new Float32Array(a.length)): Float32Array {
  for (let i = 0; i < a.length; i++) {
    const left = a[i], right = b[i];
    out[i] = !Number.isFinite(left) ? (Number.isFinite(right) ? right : NaN)
      : !Number.isFinite(right) ? left : left + (right - left) * f;
  }
  return out;
}

/** Choose the closest radar frame within maxGapMs; ties go to the earlier frame. */
export function nearestIndex(t: number, times: number[], maxGapMs: number): number {
  const lower = bracket(t, times);
  if (!lower) return -1;
  const next = Math.min(lower.i + 1, times.length - 1);
  const i = Math.abs(t - times[lower.i]) <= Math.abs(t - times[next]) ? lower.i : next;
  return Math.abs(t - times[i]) <= maxGapMs ? i : -1;
}

function localParts(t: number) {
  const date = new TZDate(t, ZONE);
  return {
    day: WEEKDAYS[date.getDay()],
    date: String(date.getDate()),
    month: MONTHS[date.getMonth()],
    time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  };
}

export function handleLabel(t: number) {
  const { day, time } = localParts(t);
  return { key: "{day} {time}", params: { day, time } };
}

export function dayLabel(t: number) {
  const { day, date, month } = localParts(t);
  return { key: "{day} {date} {month}", params: { day, date, month } };
}

export function timeBadge(t: number, d: TimeDomain, source: { radarTime?: number; onModelHour: boolean; primary: "rain" | "temp" | "pm25" }) {
  if (t <= d.now && source.primary === "rain" && source.radarTime !== undefined) {
    return { key: "เรดาร์ {time}", params: { time: localParts(source.radarTime).time } };
  }
  if (t > d.now && source.onModelHour) {
    return { key: "พยากรณ์ {time}", params: { time: localParts(t).time } };
  }
  if (t > d.now) return { key: "พยากรณ์ · ค่าประมาณระหว่างชั่วโมง", params: {} };
  if (source.primary !== "rain" && d.now - t > 5 * MINUTE) return { key: "ข้อมูลย้อนหลังไม่มีในชั้นนี้", params: {} };
  if (source.primary === "rain" && t < d.now) return { key: "ไม่มีภาพเรดาร์ช่วงนี้", params: {} };
  return { key: "ตอนนี้", params: {} };
}

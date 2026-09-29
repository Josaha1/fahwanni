import { minutesAgo } from "@/lib/format";
import type { RadarFrame } from "./types";

export function lastRadarFrames(frames: RadarFrame[], count = 6): RadarFrame[] {
  return count > 0 ? frames.slice(-count) : [];
}

export function nextFrameIndex(index: number, count: number): number {
  return count > 0 ? (index + 1) % count : 0;
}

export function minutesSinceNewest(frames: RadarFrame[], nowIso: string): number {
  return frames.length ? minutesAgo(frames[frames.length - 1].time, nowIso) : 0;
}

export function radarAgeLabel(minutes: number, stale: boolean | undefined): { key: string; warn: boolean } {
  const warn = minutes > 30 || stale === true;
  return { key: warn ? "เรดาร์ล่าช้า {n} นาที" : "อัปเดตเมื่อ {n} นาทีที่แล้ว", warn };
}

import type { AirSnapshot } from "./air";
import type { WeatherSnapshot } from "./weather/types";
import { translator } from "../i18n/core";

export const WEATHER_CACHE_MS = 10 * 60 * 1000;

export interface WeatherCacheEntry {
  snapshot: WeatherSnapshot;
  air?: AirSnapshot;
  savedAt: number;
}

export function isFresh(savedAt: number, now: number): boolean {
  return Number.isFinite(savedAt) && now >= savedAt && now - savedAt < WEATHER_CACHE_MS;
}

export function parseWeatherCache(raw: string | null): WeatherCacheEntry | undefined {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return undefined;
    const entry = value as Partial<WeatherCacheEntry>;
    if (!Number.isFinite(entry.savedAt) || !entry.snapshot ||
      !Array.isArray(entry.snapshot.hours) || !Array.isArray(entry.snapshot.days) ||
      !Array.isArray(entry.snapshot.alerts)) return undefined;
    return entry as WeatherCacheEntry;
  } catch {
    return undefined;
  }
}

export function serializeWeatherCache(entry: WeatherCacheEntry): string {
  return JSON.stringify(entry);
}

export type WeatherErrorCode = "no_key" | "offline" | "upstream" | "bad_request";

export function weatherErrorCode(body: unknown): WeatherErrorCode {
  if (body && typeof body === "object" && "error" in body) {
    const code = body.error;
    if (code === "no_key" || code === "offline" || code === "bad_request") return code;
  }
  return "upstream";
}

export function updatedAgo(savedAt: number, now: number, lang: "th" | "en"): string {
  const minutes = Math.max(0, Math.floor((now - savedAt) / 60_000));
  const t = translator(lang);
  return minutes < 1 ? t("อัปเดตเมื่อสักครู่") : t("อัปเดต {n} นาทีที่แล้ว", { n: minutes });
}

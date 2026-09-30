import type { Place } from "./place";

export type GeocodeEntry = { results: Place[]; storedAt: number };

const DAY_MS = 24 * 60 * 60 * 1000;

export function geocodeKey(q: string, lang: string): string {
  return JSON.stringify([q.toLowerCase(), lang]);
}

export function geocodeCacheAge(entry: GeocodeEntry | undefined, now: number): "fresh" | "stale" | "expired" {
  if (!entry) return "expired";
  const age = now - entry.storedAt;
  if (age < DAY_MS) return "fresh";
  return age < 7 * DAY_MS ? "stale" : "expired";
}

export function geocodeBreakerUntil(status: number | null, retryAfter: string | null, now: number): number | null {
  if (status !== null && status !== 429 && status < 500) return null;
  let delay = 60_000;
  if (status === 429 && retryAfter) {
    const seconds = Number(retryAfter);
    const parsed = Number.isFinite(seconds) && seconds >= 0
      ? seconds * 1000 : Date.parse(retryAfter) - now;
    if (Number.isFinite(parsed) && parsed >= 0) delay = Math.min(parsed, 10 * 60_000);
  }
  return now + delay;
}

export function geocodeFallback(entry: GeocodeEntry | undefined, provinces: Place[], now: number) {
  const stale = geocodeCacheAge(entry, now) !== "expired";
  return {
    results: stale ? entry!.results : provinces,
    headers: { "Cache-Control": "public, s-maxage=60", "x-geocode": stale ? "stale" : "degraded" },
  };
}

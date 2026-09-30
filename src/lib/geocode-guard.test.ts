import { describe, expect, it } from "vitest";
import { geocodeBreakerUntil, geocodeCacheAge, geocodeFallback, geocodeKey } from "./geocode-guard";
import type { Place } from "./place";

const provinces: Place[] = [{ id: "province", name: "Chiang Mai", lat: 18.79, lon: 98.99, source: "province" }];
const results: Place[] = [...provinces, { id: "city", name: "Chiang Dao", lat: 19.36, lon: 98.96, source: "search" }];
const DAY_MS = 24 * 60 * 60 * 1000;

describe("geocode guard", () => {
  it("keys queries without mixing languages or ambiguous names", () => {
    expect(geocodeKey("PAI", "th")).toBe(geocodeKey("pai", "th"));
    expect(geocodeKey("pai", "th")).not.toBe(geocodeKey("pai", "en"));
    expect(geocodeKey("a:b", "c")).not.toBe(geocodeKey("a", "b:c"));
  });

  it("opens for 429, 5xx and timeout; bounds Retry-After to ten minutes", () => {
    expect(geocodeBreakerUntil(429, null, 1000)).toBe(61_000);
    expect(geocodeBreakerUntil(503, null, 1000)).toBe(61_000);
    expect(geocodeBreakerUntil(null, null, 1000)).toBe(61_000);
    expect(geocodeBreakerUntil(429, "120", 1000)).toBe(121_000);
    expect(geocodeBreakerUntil(429, "9999", 1000)).toBe(601_000);
    expect(geocodeBreakerUntil(429, new Date(91_000).toUTCString(), 1000)).toBe(91_000);
    expect(geocodeBreakerUntil(404, null, 1000)).toBeNull();
  });

  it("serves saved results for seven days with short stale headers", () => {
    const entry = { results, storedAt: 0 };
    expect(geocodeCacheAge(entry, DAY_MS - 1)).toBe("fresh");
    expect(geocodeCacheAge(entry, DAY_MS)).toBe("stale");
    expect(geocodeFallback(entry, provinces, DAY_MS)).toEqual({
      results, headers: { "Cache-Control": "public, s-maxage=60", "x-geocode": "stale" },
    });
    expect(geocodeCacheAge(entry, 7 * DAY_MS)).toBe("expired");
    expect(geocodeFallback(entry, provinces, 7 * DAY_MS)).toEqual({
      results: provinces, headers: { "Cache-Control": "public, s-maxage=60", "x-geocode": "degraded" },
    });
  });
});

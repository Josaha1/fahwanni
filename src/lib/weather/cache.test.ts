import { describe, expect, it } from "vitest";
import { WeatherCache } from "./cache";
import type { WeatherSnapshot } from "./types";

const snapshot = (tempC: number): WeatherSnapshot => ({ tempC, hours: [], days: [], alerts: [] });

describe("WeatherCache", () => {
  it("keeps entries fresh for 10 minutes", () => {
    let now = 0;
    const cache = new WeatherCache(() => now);
    const value = snapshot(30);
    cache.set("bangkok", value);

    now = 10 * 60 * 1000 - 1;
    expect(cache.getFresh("bangkok")).toBe(value);
    now += 1;
    expect(cache.getFresh("bangkok")).toBeUndefined();
  });

  it("keeps expired entries available for fallback until 24 hours", () => {
    let now = 0;
    const cache = new WeatherCache(() => now);
    const value = snapshot(30);
    cache.set("bangkok", value);

    now = 24 * 60 * 60 * 1000 - 1;
    expect(cache.getStale("bangkok")).toBe(value);
    now += 1;
    expect(cache.getStale("bangkok")).toBeUndefined();
  });

  it("evicts the oldest entry when the cache is full", () => {
    const cache = new WeatherCache(() => 0, 2);
    cache.set("first", snapshot(1));
    cache.set("second", snapshot(2));
    cache.set("third", snapshot(3));

    expect(cache.getFresh("first")).toBeUndefined();
    expect(cache.getFresh("second")?.tempC).toBe(2);
    expect(cache.getFresh("third")?.tempC).toBe(3);
  });
});

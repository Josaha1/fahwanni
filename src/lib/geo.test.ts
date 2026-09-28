import { describe, expect, it } from "vitest";
import { cacheKey, parseLatLon, roundCoord } from "./geo";

describe("geo", () => {
  it("rounds coordinates to two decimal places", () => {
    expect(roundCoord(13.7563)).toBe(13.76);
    expect(roundCoord(-100.504)).toBe(-100.5);
  });

  it("parses numeric coordinates including valid boundaries", () => {
    expect(parseLatLon("13.75", "100.50")).toEqual({ lat: 13.75, lon: 100.5 });
    expect(parseLatLon(-90, 180)).toEqual({ lat: -90, lon: 180 });
    expect(parseLatLon(90, -180)).toEqual({ lat: 90, lon: -180 });
  });

  it("rejects missing, non-finite, and out-of-range coordinates", () => {
    expect(parseLatLon("", 100)).toBeNull();
    expect(parseLatLon(null, 100)).toBeNull();
    expect(parseLatLon("NaN", 100)).toBeNull();
    expect(parseLatLon(Infinity, 100)).toBeNull();
    expect(parseLatLon(90.01, 100)).toBeNull();
    expect(parseLatLon(0, -180.01)).toBeNull();
  });

  it("uses rounded coordinates and language for cache keys", () => {
    expect(cacheKey(13.7563, 100.504, "th")).toBe(cacheKey(13.76, 100.5, "th"));
    expect(cacheKey(13.7563, 100.504, "en")).not.toBe(cacheKey(13.7563, 100.504, "th"));
  });
});

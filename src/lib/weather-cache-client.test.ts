import { describe, expect, it } from "vitest";
import { isFresh, parseWeatherCache, serializeWeatherCache, updatedAgo, weatherErrorCode } from "./weather-cache-client";

const entry = { snapshot: { hours: [], days: [], alerts: [] }, savedAt: 1_000 };

describe("weather client cache", () => {
  it("uses a ten-minute freshness window", () => {
    expect(isFresh(1_000, 600_999)).toBe(true);
    expect(isFresh(1_000, 601_000)).toBe(false);
    expect(isFresh(2_000, 1_000)).toBe(false);
  });

  it("round-trips an entry and ignores corrupt data", () => {
    expect(parseWeatherCache(serializeWeatherCache(entry))).toEqual(entry);
    expect(parseWeatherCache("{")).toBeUndefined();
    expect(parseWeatherCache('{"savedAt":1000,"snapshot":{}}')).toBeUndefined();
  });

  it("maps API errors and formats elapsed time in both languages", () => {
    expect(weatherErrorCode({ error: "no_key" })).toBe("no_key");
    expect(weatherErrorCode({ error: "unexpected" })).toBe("upstream");
    expect(updatedAgo(0, 120_000, "th")).toBe("อัปเดต 2 นาทีที่แล้ว");
    expect(updatedAgo(0, 60_000, "en")).toBe("Updated 1 minute ago");
  });
});

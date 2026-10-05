import { describe, expect, it } from "vitest";
import { getGeocodeAttempts, mapOpenMeteoResults } from "./geocode";
import type { Place } from "./place";

describe("mapOpenMeteoResults", () => {
  it("keeps only TH results and removes province coordinate and name duplicates", () => {
    const province: Place = { id: "chiang-mai", name: "เชียงใหม่", admin: "Chiang Mai", lat: 18.7877, lon: 98.9931, source: "province" };
    const data = { results: [
      { id: 1, country_code: "TH", name: "Chiang Mai", latitude: 18.9, longitude: 99.2 },
      { id: 2, country_code: "TH", name: "Other", latitude: 18.79, longitude: 98.99 },
      { id: 3, name: "Paris", admin1: "Île-de-France", country: "France", latitude: 48.8566, longitude: 2.3522 },
    ] };
    expect(mapOpenMeteoResults(data, [province])).toEqual([]);
    expect(mapOpenMeteoResults(data, [province], 1)).toEqual([]);
  });
});

describe("getGeocodeAttempts", () => {
  it("tries the district prefix before English for Thai-script queries", () => {
    expect(getGeocodeAttempts("หัวหิน", "th")).toEqual([
      { name: "หัวหิน", language: "th" },
      { name: "อำเภอหัวหิน", language: "th" },
      { name: "หัวหิน", language: "en" },
    ]);
  });

  it("avoids another district prefix and keeps the existing non-Thai fallback", () => {
    for (const prefix of ["อำเภอ", "เขต", "ตำบล"]) {
      expect(getGeocodeAttempts(`${prefix}หัวหิน`, "th")).toEqual([
        { name: `${prefix}หัวหิน`, language: "th" },
        { name: `${prefix}หัวหิน`, language: "en" },
      ]);
    }
    expect(getGeocodeAttempts("pai", "th")).toEqual([
      { name: "pai", language: "th" },
      { name: "pai", language: "en" },
    ]);
    expect(getGeocodeAttempts("pai", "en")).toEqual([{ name: "pai", language: "en" }]);
    expect(getGeocodeAttempts("หัวหิน", "en")).toEqual([
      { name: "หัวหิน", language: "en" },
      { name: "อำเภอหัวหิน", language: "en" },
      { name: "หัวหิน", language: "en" },
    ]);
  });
});

describe("Open-Meteo ranking and display", () => {
  const data = { results: [
    { id: 1, name: "Pai", country_code: "ID", country: "Indonesia", latitude: -1, longitude: 101 },
    { id: 2, name: "Pai", country_code: "TH", country: "Thailand", admin1: "จังหวัดแม่ฮ่องสอน", latitude: 19.36, longitude: 98.44 },
    { id: 3, name: "Another", country_code: "TH", country: "Thailand", admin1: "เชียงใหม่", latitude: 19, longitude: 99 },
    { id: 4, name: "Elsewhere", country_code: "ID", country: "Indonesia", latitude: -2, longitude: 102 },
    { id: 5, name: "Further", country_code: "ID", country: "Indonesia", latitude: -3, longitude: 103 },
  ] };

  it("keeps only Thailand in the published order", () => {
    expect(mapOpenMeteoResults(data, [], 8, "en").map((place) => place.id)).toEqual([
      "open-meteo-2", "open-meteo-3",
    ]);
  });

  it("removes จังหวัด from Thai admin names only", () => {
    expect(mapOpenMeteoResults(data, [], 8, "th")[0].admin).toBe("แม่ฮ่องสอน");
    expect(mapOpenMeteoResults(data, [], 8, "en")[0].admin).toBe("จังหวัดแม่ฮ่องสอน");
  });
});

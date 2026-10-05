import { describe, expect, it } from "vitest";
import { translator } from "@/i18n/core";
import type { Place } from "./place";
import { buildFloodShareText, buildShareText } from "./share";
import type { WeatherSnapshot } from "./weather/types";

const bangkok: Place = {
  id: "bangkok", name: "กรุงเทพมหานคร", admin: "Bangkok", lat: 13.75, lon: 100.5, source: "province",
};

const snapshot: WeatherSnapshot = {
  tempC: 28, feelsLikeC: 33, heatIndexC: 40, conditionType: "LIGHT_THUNDERSTORM_RAIN",
  hours: [], alerts: [], fetchedAt: "2026-09-28T12:00:00.000Z", isDaytime: false,
  days: [{ minTempC: 25, maxTempC: 29, day: { rainChance: 70 }, night: { rainChance: 30 } }],
};

describe("buildShareText", () => {
  it("builds Thai weather, air, and at most two advice lines", () => {
    const text = buildShareText(snapshot, { pm25: 16.8 }, bangkok, "th", translator("th"), "all");
    expect(text).toContain("ฟ้าวันนี้ · กรุงเทพมหานคร\n28° ฝนฟ้าคะนองเล็กน้อย (รู้สึกเหมือน 33°)");
    expect(text).toContain("วันนี้ 25–29° โอกาสฝน 70%\nPM2.5 16.8 (ดี)");
    expect(text.split("\n").filter((line) => line.startsWith("• "))).toHaveLength(2);
  });

  it("builds English text with the English province name", () => {
    const text = buildShareText(snapshot, { pm25: 16.8 }, bangkok, "en", translator("en"), "all");
    expect(text).toContain("Today's Sky · Bangkok\n28° Light thunderstorm rain (feels like 33°)");
    expect(text).toContain("Today 25–29°, 70% chance of rain\nPM2.5 16.8 (Good)");
    expect(text).not.toContain("ฟ้าวันนี้");
  });

  it("omits unavailable air and daily forecast details", () => {
    const text = buildShareText({ ...snapshot, days: [] }, undefined, bangkok, "th", translator("th"), "all");
    expect(text).not.toContain("PM2.5");
    expect(text).not.toContain("วันนี้ 25–29°");
    expect(text).toContain("28° ฝนฟ้าคะนองเล็กน้อย");
  });
});

describe("flood sharing", () => {
  it("omits hidden AQI from weather text even if air data is still loaded", () => {
    expect(buildShareText(snapshot, { pm25: 160 }, bangkok, "th", translator("th"))).not.toContain("PM2.5");
  });
  it("keeps every source's own time and does not imply measured area or safety", () => {
    const text = buildFloodShareText({ eventProvinces: 2, eventsAt: "2026-10-05T00:00:00Z",
      warnings: 0, warningsAt: "2026-10-05T01:00:00Z", satellitePoints: 12, satelliteDate: "2026-10-04" }, translator("th"));
    for (const value of ["2 จังหวัด", "ไม่มีประกาศเตือนภัย", "12 จุดตรวจ", "2026-10-04", "GLIDE / GDACS", "NASA VIIRS", "TMD", "1784", "เมฆ"]) expect(text).toContain(value);
    expect(text).not.toContain("ปลอดภัย");
    expect(text).not.toContain("ระดับน้ำ");
  });
  it("distinguishes unavailable data from zero and translates the entire summary", () => {
    const text = buildFloodShareText({ eventProvinces: null, warnings: null, satellitePoints: null }, translator("en"));
    expect(text).not.toMatch(/[\u0e00-\u0e7f]/);
    expect(text).toContain("unavailable");
    expect(text).not.toContain("No warnings");
    expect(text).toContain("Data date unknown");
  });
});

import { describe, expect, it } from "vitest";
import { translator } from "@/i18n/core";
import { damBand, damBandColor } from "@/lib/dams/bands";
import type { PixelCounts } from "@/lib/flood/viirs";
import { distanceKm } from "@/lib/storms/normalize";
import {
  provinceBins, rainGauge, satelliteRing, streamRate, tankFill,
  visualSummaryProvince, visualSummaryRain, visualSummarySatellite, visualSummaryStream, visualSummaryTank,
} from "./index";

const counts = (flood: number, recurringFlood = 0): PixelCounts => ({
  flood, recurringFlood, dry: 1, water: 0, insufficientData: 0, noData: 0, sampled: flood + recurringFlood + 1,
});

describe("pure visual mappings", () => {
  it.each([[0, null], [35, null], [35.1, "heavy"], [90, "heavy"], [90.1, "veryHeavy"]] as const)(
    "uses TMD boundaries for %s mm", (mm, category) => {
      expect(rainGauge(mm, 200)).toMatchObject({ state: "data", value: mm, category });
    },
  );

  it("caps rain geometry while keeping the reported value and category", () => {
    expect(rainGauge(250, 100)).toEqual({ state: "data", value: 250, shown: 100, ratio: 1, capped: true, category: "veryHeavy" });
    expect(rainGauge(50, 100)).toMatchObject({ ratio: 0.5, capped: false });
  });

  it.each([0, 30, 30.1, 50, 50.1, 80, 80.1, 100, 100.1, 120, 200])(
    "keeps the capacity crest and existing RID band/color at %s percent", (pct) => {
      expect(tankFill(pct, 120)).toMatchObject({
        state: "data", value: pct, height: Math.min(pct, 120) / 100, crest: 1,
        band: damBand(pct), color: damBandColor(damBand(pct)), capped: pct > 120,
      });
    },
  );

  it.each(["cms", "mm"] as const)("bounds %s motion without changing the measurement", (unit) => {
    expect(streamRate(0, unit, 100)).toMatchObject({ state: "data", ratio: 0, capped: false, unit });
    expect(streamRate(50, unit, 100)).toMatchObject({ ratio: 0.5 });
    expect(streamRate(100, unit, 100)).toMatchObject({ ratio: 1, capped: false });
    expect(streamRate(1000, unit, 100)).toMatchObject({ value: 1000, shown: 100, ratio: 1, capped: true });
  });

  it.each([null, NaN, Infinity, -Infinity, -1])("treats invalid measurements as no-data: %s", (value) => {
    expect(rainGauge(value, 100)).toEqual({ state: "no-data" });
    expect(tankFill(value, 120)).toEqual({ state: "no-data" });
    expect(streamRate(value, "cms", 100)).toEqual({ state: "no-data" });
  });

  it.each([0, -1, NaN, Infinity])("rejects invalid caps: %s", (cap) => {
    expect(rainGauge(10, cap).state).toBe("no-data");
    expect(tankFill(10, cap).state).toBe("no-data");
    expect(streamRate(10, "mm", cap).state).toBe("no-data");
  });

  it("requires space above the tank crest", () => {
    expect(tankFill(105, 100).state).toBe("no-data");
    expect(tankFill(105, 120)).toMatchObject({ height: 1.05 });
  });

  it.each([[0, 0], [1, 1], [20, 1], [21, 2], [200, 2], [201, 3]])(
    "bins %s flood + recurring-flood points", (count, bin) => {
      expect(provinceBins(counts(0, count))).toEqual({ state: "data", count, bin });
      expect(provinceBins(counts(count))).toEqual({ state: "data", count, bin });
    },
  );

  it("distinguishes missing or unobserved province data from zero detections", () => {
    expect(provinceBins(null).state).toBe("no-data");
    expect(provinceBins({ ...counts(0), dry: 0, sampled: 0 }).state).toBe("no-data");
    expect(provinceBins({ ...counts(0), dry: 0, insufficientData: 1 }).state).toBe("no-data");
    expect(provinceBins({ ...counts(0), dry: 0, noData: 1 }).state).toBe("no-data");
    expect(provinceBins({ ...counts(0), flood: NaN }).state).toBe("no-data");
    expect(provinceBins(counts(0))).toMatchObject({ state: "data", bin: 0 });
    expect(provinceBins(counts(10, 11))).toMatchObject({ count: 21, bin: 2 });
  });

  it("projects actual positions east/north and excludes points beyond the radius", () => {
    const place = { lat: 15, lon: 100 };
    const samples = [
      { lat: 15, lon: 100.1, kind: "flood" as const },
      { lat: 15.1, lon: 100, kind: "recurring-flood" as const },
      { lat: 15, lon: 99.9, kind: "insufficient-data" as const },
      { lat: 14.9, lon: 100, kind: "dry" as const },
      { lat: 16, lon: 100, kind: "flood" as const },
      { lat: NaN, lon: 100, kind: "flood" as const },
    ];
    const original = structuredClone(samples);
    const ring = satelliteRing(samples, place);
    expect(ring).toMatchObject({ state: "data", flood: 2, insufficient: 1, radiusKm: 30 });
    if (!("points" in ring)) throw new Error("Missing projected points");
    expect(ring.points).toHaveLength(4);
    expect(ring.points[0].eastKm).toBeGreaterThan(0);
    expect(ring.points[1].northKm).toBeGreaterThan(0);
    expect(ring.points[1].eastKm).toBeCloseTo(0);
    expect(ring.points[2].eastKm).toBeLessThan(0);
    expect(ring.points[3].northKm).toBeLessThan(0);
    for (const point of ring.points) {
      expect(Math.hypot(point.eastKm, point.northKm)).toBeCloseTo(distanceKm(place, point), 8);
    }
    expect(samples).toEqual(original);
    const boundary = distanceKm(place, samples[0]);
    expect(satelliteRing([samples[0]], place, boundary).state).toBe("data");
    expect(satelliteRing([samples[0]], place, boundary - 0.001).state).toBe("no-data");
  });

  it("handles missing satellite observations and retains grey observation points", () => {
    const place = { lat: 15, lon: 100 };
    expect(satelliteRing(null, place).state).toBe("no-data");
    expect(satelliteRing([], place).state).toBe("no-data");
    expect(satelliteRing([], null).state).toBe("no-data");
    expect(satelliteRing([], { lat: 91, lon: 100 }).state).toBe("no-data");
    expect(satelliteRing([], place, 0).state).toBe("no-data");
    expect(satelliteRing([{ ...place, kind: "insufficient-data" }], place))
      .toMatchObject({ state: "no-data", insufficient: 1, points: [{ eastKm: 0, northKm: 0 }] });
    expect(satelliteRing([{ ...place, kind: "dry" }], place)).toMatchObject({ state: "data", flood: 0 });
  });
});

describe("one-line visual summaries", () => {
  it.each(["th", "en"] as const)("translates every data and no-data caption in %s", (locale) => {
    const t = translator(locale);
    const captions = [
      ...[null, 0, 35, 90, 250].map((mm) => visualSummaryRain(rainGauge(mm, 100), t)),
      ...[null, 0, 40, 70, 90, 105].map((pct) => visualSummaryTank(tankFill(pct, 120), t)),
      visualSummarySatellite(satelliteRing(null, null), t),
      visualSummarySatellite(satelliteRing([
        { lat: 15, lon: 100, kind: "flood" }, { lat: 15.1, lon: 100, kind: "insufficient-data" },
      ], { lat: 15, lon: 100 }), t),
      ...[null, counts(0), counts(201)].map((count) => visualSummaryProvince(provinceBins(count), t)),
      ...[null, 0, 1234.5].flatMap((value) => ["cms", "mm"].map((unit) =>
        visualSummaryStream(streamRate(value, unit as "cms" | "mm", 100), t))),
    ];
    for (const caption of captions) {
      expect(caption.length).toBeGreaterThan(0);
      expect(caption).not.toMatch(/ปลอดภัย|ระดับน้ำ|\n|\{\w+\}/);
      if (locale === "en") expect(caption).not.toMatch(/[฀-๿]/);
    }
    expect(visualSummaryRain(rainGauge(250, 100), t)).toContain("250");
    expect(visualSummaryTank(tankFill(250, 120), t)).toContain("250%");
    expect(visualSummaryStream(streamRate(1234.5, "cms", 100), t)).toContain("1,234.5");
  });
});

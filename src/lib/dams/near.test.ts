import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import downstream from "../../../public/data/dam-downstream.json";
import fixture from "./fixture-rid.json";
import type { DamsPayload } from "./client";
import { upstreamDamsFor } from "./near";
import { parseRidDams } from "./rid";
import type { DamPath } from "./paths";

const parsed = parseRidDams(fixture);
const dams: DamsPayload = { dams: parsed.dams, dataDate: parsed.dataDate, fetchedAt: "", stale: false };
const paths = JSON.parse(readFileSync(new URL("../../../public/data/dam-paths.geojson", import.meta.url), "utf8")) as {
  type: "FeatureCollection"; features: DamPath[];
};
const input = { paths, downstream, dams };
const pingPath = paths.features.find((path) => path.properties.damId === "200101")!;
const withBhumibol = (patch: Partial<DamsPayload["dams"][number]>): DamsPayload =>
  ({ ...dams, dams: dams.dams.map((dam) => dam.id === "200101" ? { ...dam, ...patch } : dam) });
const tak = { lat: 16.87, lon: 99.13 };

describe("upstreamDamsFor", () => {
  it("finds Bhumibol near Tak when it is more than 80% full", () => {
    const result = upstreamDamsFor(tak, { ...input, dams: withBhumibol({ storagePct: 90, highRelease: false }) });
    expect(result[0]).toMatchObject({ damId: "200101", nameTh: "ภูมิพล", storagePct: 90, reason: "storage" });
    expect(result[0].kmToUser).toBeGreaterThan(20);
    expect(result[0].kmToUser).toBeLessThan(120);
  });

  it("reports a high release when storage is at most 80%", () => {
    const result = upstreamDamsFor(tak, { ...input, dams: withBhumibol({ storagePct: 64, highRelease: true }) });
    expect(result.find((dam) => dam.damId === "200101")?.reason).toBe("release");
  });

  it("hides a dam at most 80% full without a high release", () => {
    expect(upstreamDamsFor(tak, {
      ...input, paths: { type: "FeatureCollection", features: [pingPath] },
      dams: withBhumibol({ storagePct: 80, highRelease: false }),
    })).toEqual([]);
  });

  it("rejects a place more than 10 km from the path", () => {
    expect(upstreamDamsFor({ lat: 16.87, lon: 99.5 }, {
      ...input, paths: { type: "FeatureCollection", features: [pingPath] }, dams: withBhumibol({ storagePct: 90 }),
    })).toEqual([]);
  });

  it("rejects a place more than 300 km downstream", () => {
    const coordinates = pingPath.geometry.coordinates;
    const point = coordinates[Math.floor(coordinates.length * 0.8)];
    expect(upstreamDamsFor({ lat: point[1], lon: point[0] }, {
      ...input, paths: { type: "FeatureCollection", features: [pingPath] }, dams: withBhumibol({ storagePct: 90 }),
    })).toEqual([]);
  });
});

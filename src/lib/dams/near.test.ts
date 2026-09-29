import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import downstream from "../../../public/data/dam-downstream.json";
import fixture from "./fixture-thaiwater.json";
import type { DamsPayload } from "./client";
import { upstreamDamsFor } from "./near";
import { parseThaiWater } from "./thaiwater";
import type { DamPath } from "./paths";

const normalized = parseThaiWater(fixture);
const dams: DamsPayload = { ...normalized, dataDate: normalized.dataDate, fetchedAt: "", stale: false };
const paths = JSON.parse(readFileSync(new URL("../../../public/data/dam-paths.geojson", import.meta.url), "utf8")) as {
  type: "FeatureCollection"; features: DamPath[];
};
const input = { paths, downstream, dams };
const pingPath = paths.features.find((path) => path.properties.damId === "1")!;

describe("upstreamDamsFor", () => {
  it("finds Bhumibol near Tak when the nearest downstream station is high", () => {
    const p2a = { ...dams.stations[0], code: "P.2A", nameTh: "สถานี P.2A", situation: 4 as const, pctBank: 82 };
    const result = upstreamDamsFor({ lat: 16.87, lon: 99.13 }, {
      ...input, dams: { ...dams, stations: [...dams.stations, p2a] },
    });
    expect(result[0]).toMatchObject({
      damId: "1", nameTh: "ภูมิพล", reason: "river",
      nearStation: { code: "P.2A", situation: 4, km: 60.3 },
    });
    expect(result[0].kmToUser).toBeCloseTo(56.16, 0);
  });

  it("uses C.2 when it is the closest downstream station", () => {
    const c2 = dams.stations.find((station) => station.code === "C.2")!;
    const result = upstreamDamsFor(c2, input);
    expect(result.find((dam) => dam.damId === "1")?.nearStation?.code).toBe("C.2");
  });

  it("rejects a place more than 10 km from the path", () => {
    const p2a = { ...dams.stations[0], code: "P.2A", situation: 4 as const };
    expect(upstreamDamsFor({ lat: 16.87, lon: 99.5 }, {
      ...input, paths: { type: "FeatureCollection", features: [pingPath] },
      dams: { ...dams, stations: [...dams.stations, p2a] },
    })).toEqual([]);
  });

  it("rejects a place more than 300 km downstream", () => {
    const coordinates = pingPath.geometry.coordinates;
    const point = coordinates[Math.floor(coordinates.length * 0.8)];
    expect(upstreamDamsFor({ lat: point[1], lon: point[0] }, {
      ...input, paths: { type: "FeatureCollection", features: [pingPath] },
      dams: { ...dams, dams: [{ ...dams.dams.find((dam) => dam.id === "1")!, storagePct: 90 }] },
    })).toEqual([]);
  });

  it("hides a dam when storage is at most 80 and all stations are below level 4", () => {
    const p2a = { ...dams.stations[0], code: "P.2A", situation: 3 as const };
    expect(upstreamDamsFor({ lat: 16.87, lon: 99.13 }, {
      ...input, paths: { type: "FeatureCollection", features: [pingPath] },
      dams: { ...dams, stations: [...dams.stations.map((station) => ({ ...station, situation: 3 as const })), p2a] },
    })).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { describe, expect, it, vi } from "vitest";
import { provinces, provinceIdFromShapeName } from "../provinces";
import { prepareProvinceMask, provinceAt, provinceIndexAt, type ProvinceGeoJson, type ProvinceMask } from "./mask";
import { decodePalettePng } from "./png";
import { distanceKm } from "../storms/normalize";
import { classifyPixel, nationalSamples, nearMe, pixelPosition, provinceCounts, regionCounts, sampleTiles, thailandTiles, type FloodSample, type FloodTile } from "./viirs";

const geojson = JSON.parse(readFileSync("public/data/th-provinces-adm1.geojson", "utf8")) as ProvinceGeoJson;
const masks = prepareProvinceMask(geojson);
const square = (west: number, south: number, east: number, north: number): [number, number][] =>
  [[west, south], [east, south], [east, north], [west, north], [west, south]];

it("matches all 77 actual shape names to 77 existing province IDs", () => {
  expect(provinces).toHaveLength(77);
  expect(geojson.features).toHaveLength(77);
  expect(new Set(masks.map((mask) => mask.id))).toEqual(new Set(provinces.map((province) => province.id)));
  expect(provinceIdFromShapeName("Roi Et Province")).toBe("roi-et");
  expect(provinceIdFromShapeName("Bangkok")).toBe("bangkok");
  expect(provinceIdFromShapeName("Phangnga Province")).toBe("phang-nga");
  expect(provinceIdFromShapeName("Lopburi Province")).toBe("lop-buri");
  expect(provinceIdFromShapeName("Unknown Province")).toBeNull();
  expect(() => prepareProvinceMask({ ...geojson, features: geojson.features.slice(1) })).toThrow("77");
});

it("locates real Bangkok and Roi Et and excludes neighbouring countries and the sea", () => {
  expect(provinceAt(100.5241, 13.7279, masks)).toBe("bangkok");
  expect(provinceAt(103.652, 16.0538, masks)).toBe("roi-et");
  expect(provinceAt(104.9, 12, masks)).toBeNull();
  expect(provinceAt(101, 8, masks)).toBeNull();
});

it("ray casts MultiPolygons and holes, and checks each province bbox first", () => {
  const mask: ProvinceMask = { id: "bangkok", bbox: [0, 0, 6, 6], polygons: [
    [square(0, 0, 4, 4), square(1, 1, 2, 2)], [square(5, 5, 6, 6)],
  ] };
  expect(provinceAt(3, 3, [mask])).toBe("bangkok");
  expect(provinceAt(0, 3, [mask])).toBe("bangkok");
  expect(provinceAt(1.5, 1.5, [mask])).toBeNull();
  expect(provinceAt(1, 1.5, [mask])).toBeNull();
  expect(provinceAt(5.5, 5.5, [mask])).toBe("bangkok");
  expect(provinceAt(4.5, 4.5, [mask])).toBeNull();
  expect(provinceAt(9, 9, [{ ...mask, polygons: [] }])).toBeNull();
});

it("tries the previous province first and falls back when its bbox or polygon misses", () => {
  const first: ProvinceMask = { id: "bangkok", bbox: [0, 0, 4, 4], polygons: [[square(0, 0, 4, 4)]] };
  const second: ProvinceMask = { id: "roi-et", bbox: [5, 5, 9, 9], polygons: [[square(5, 5, 9, 9), square(6, 6, 7, 7)]] };
  const firstCheck = vi.spyOn(first.polygons, "some");
  expect(provinceIndexAt(8, 8, [first, second], 1)).toBe(1);
  expect(firstCheck).not.toHaveBeenCalled();
  expect(provinceIndexAt(3, 3, [first, second], 1)).toBe(0);
  expect(provinceIndexAt(6.5, 6.5, [first, second], 1)).toBe(-1);
  firstCheck.mockRestore();
});

describe("VIIRS tile sampling", () => {
  const image = decodePalettePng(readFileSync(new URL("./fixture-flood-tile.png", import.meta.url)));
  const tile: FloodTile = { x: 99, y: 58, z: 7, image };

  it("classifies the NASA palette without treating surface water or transparent dry land as flood", () => {
    expect(image.palette.slice(0, 6).map(classifyPixel)).toEqual(["no-data", "dry", "water", "recurring-flood", "flood", "insufficient-data"]);
    expect(classifyPixel([99, 99, 99, 255])).toBe("no-data");
  });

  it("counts the fixture with exact polygon masking; outside pixels and holes are ignored", () => {
    const box: ProvinceMask = { id: "bangkok", bbox: [-180, -90, 180, 90], polygons: [[square(-180, -90, 180, 90)]] };
    const counts = provinceCounts([tile], [box]);
    expect(counts.bangkok.sampled).toBe(65536);
    expect(counts.bangkok.dry).toBe(image.pixels.filter((value) => value === 1).length);
    expect(counts.bangkok.insufficientData).toBe(image.pixels.filter((value) => value === 5).length);
    expect(counts.bangkok.flood).toBe(0);
    const mixed = { ...tile, image: { ...image, pixels: Uint8Array.from(image.pixels, (_, i) => i % 6) } };
    const mixedCounts = provinceCounts([mixed], [box]).bangkok;
    for (const kind of ["flood", "recurringFlood", "water", "dry", "insufficientData", "noData"] as const) expect(mixedCounts[kind]).toBeGreaterThan(0);
    const point = pixelPosition(tile, 128, 128);
    const hole = square(point.lon - 0.3, point.lat - 0.3, point.lon + 0.3, point.lat + 0.3);
    const holed = provinceCounts([tile], [{ ...box, polygons: [[box.polygons[0][0], hole]] }]);
    expect(holed.bangkok.sampled).toBeLessThan(65536);
    expect(provinceCounts([tile], masks).bangkok.sampled).toBeLessThan(65536);
    expect(sampleTiles([tile], []).length).toBe(0);
    const regions = regionCounts(counts);
    expect(regions.central).toEqual(counts.bangkok);
    expect(Object.values(regions).reduce((sum, region) => sum + region.sampled, 0)).toBe(65536);
  });

  it("generates unique tiles covering both north and south Thailand at zoom 7", () => {
    const tiles = thailandTiles();
    expect(new Set(tiles.map((item) => `${item.x},${item.y}`)).size).toBe(tiles.length);
    for (const p of [provinces[0], provinces.find((p) => p.id === "chiang-rai")!, provinces.find((p) => p.id === "yala")!]) {
      expect(tiles.some((coordinate) => {
        const northwest = pixelPosition({ ...coordinate, image }, 0, 0);
        const southeast = pixelPosition({ ...coordinate, image }, 255, 255);
        return p.lon > northwest.lon && p.lon < southeast.lon && p.lat < northwest.lat && p.lat > southeast.lat;
      })).toBe(true);
    }
  });

  it("samples a refreshed tile faster using cached province indices and current pixels", () => {
    const freshMasks = prepareProvinceMask(geojson);
    const started = performance.now();
    const first = sampleTiles([tile], freshMasks);
    const coldDuration = performance.now() - started;
    const checks = freshMasks.map((mask) => vi.spyOn(mask.polygons, "some"));
    const refreshed = { ...tile, image: { ...image, pixels: new Uint8Array(image.pixels.length).fill(4) } };
    const warmStarted = performance.now();
    const second = sampleTiles([refreshed], freshMasks);
    const warmDuration = performance.now() - warmStarted;
    expect(warmDuration).toBeLessThan(coldDuration);
    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first.map((sample) => ({ ...sample, kind: "flood" })));
    for (const check of checks) { expect(check).not.toHaveBeenCalled(); check.mockRestore(); }
  });

  it("keeps province index caches separate for different masks, tile coordinates and dimensions", () => {
    const box: ProvinceMask = { id: "bangkok", bbox: [99, 13, 101, 17], polygons: [[square(99, 13, 101, 17)]] };
    const set = [box];
    const first = sampleTiles([tile], set);
    expect(first.length).toBeGreaterThan(0);
    expect(sampleTiles([tile], [{ ...box, id: "roi-et" }])).toEqual(first.map((sample) => ({ ...sample, provinceId: "roi-et" })));
    expect(sampleTiles([{ ...tile, x: 0 }], set)).toEqual([]);
    const smaller = { ...tile, image: { ...image, width: 2, height: 2, pixels: new Uint8Array(4).fill(4) } };
    const expected = Array.from({ length: 4 }, (_, at) => pixelPosition(smaller, at % 2, Math.floor(at / 2)))
      .filter((point) => provinceAt(point.lon, point.lat, set))
      .map((point) => ({ ...point, provinceId: "bangkok", kind: "flood" }));
    expect(sampleTiles([smaller], set)).toEqual(expected);
  });
});

it("uses a 30 km circle and gives flood priority over cloud/no-data, with honest negative results", () => {
  const place = { lat: 13.7, lon: 100.5 };
  const sample = (kind: FloodSample["kind"], lat = 13.7): FloodSample => ({ ...place, lat, provinceId: "bangkok", kind });
  expect(nearMe([sample("water"), sample("dry"), sample("flood", 14.7)], place)).toMatchObject({ radiusKm: 30, verdict: "not-seen", counts: { sampled: 2 } });
  expect(nearMe([sample("insufficient-data"), sample("dry")], place).verdict).toBe("cloud-or-no-data");
  expect(nearMe([sample("no-data")], place).verdict).toBe("cloud-or-no-data");
  expect(nearMe([], place).verdict).toBe("cloud-or-no-data");
  expect(nearMe([sample("insufficient-data"), ...Array.from({ length: 5 }, () => sample("flood"))], place).verdict).toBe("flood");
  expect(nearMe(Array.from({ length: 5 }, () => sample("recurring-flood")), place).verdict).toBe("flood");
});

describe("display samples", () => {
  const place = { lat: 13.7, lon: 100.5 };
  const sample = (kind: FloodSample["kind"], i = 0): FloodSample => ({
    lat: 13.7000123 + i * 0.0001, lon: 100.5000567, provinceId: "bangkok", kind,
  });
  const points = (kind: FloodSample["kind"], length: number) => Array.from({ length }, (_, i) => sample(kind, i));
  const rounded = ({ lat, lon, kind }: FloodSample) => ({ lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)), kind });

  it("filters display kinds and radius before rounding, while counting every in-radius kind", () => {
    const boundary = { ...sample("flood"), lat: 13.96 };
    const radius = distanceKm(place, boundary);
    const input = [...["flood", "recurring-flood", "water", "insufficient-data", "dry", "no-data"].map((kind) => sample(kind as FloodSample["kind"])),
      boundary, { ...boundary, lat: 13.961 }];
    const original = structuredClone(input);
    expect(nearMe(input, place, radius)).toMatchObject({ sampleCap: 400, thinned: false,
      counts: { sampled: 7, flood: 2, recurringFlood: 1, dry: 1, water: 1, insufficientData: 1, noData: 1 },
      samples: [rounded(input[0]), rounded(input[1]), rounded(boundary), rounded(input[2]), rounded(input[3])],
    });
    expect(input).toEqual(original);
    expect(nearMe([], place)).toMatchObject({ samples: [], sampleCap: 400, thinned: false });
  });

  it("retains every flood detection and evenly thins other points into the remaining budget", () => {
    const other = [...points("water", 300), ...points("insufficient-data", 300)];
    const priority = [...points("flood", 50), ...points("recurring-flood", 50)];
    const result = nearMe([...other, ...points("dry", 500), ...priority], place);
    expect(result).toMatchObject({ sampleCap: 400, thinned: true, verdict: "flood",
      counts: { sampled: 1200, flood: 50, recurringFlood: 50, water: 300, insufficientData: 300, dry: 500 } });
    expect(result.samples).toEqual([...priority.map(rounded), ...Array.from({ length: 300 }, (_, i) => rounded(other[Math.floor(i * 599 / 299)]))]);
  });

  it("thins only flood detections when they alone exceed the cap", () => {
    const priority = Array.from({ length: 800 }, (_, i) => sample(i % 2 ? "recurring-flood" : "flood", i));
    const result = nearMe([...points("water", 500), ...priority], place);
    expect(result.samples).toEqual(Array.from({ length: 400 }, (_, i) => rounded(priority[Math.floor(i * 799 / 399)])));
    expect(result).toMatchObject({ sampleCap: 400, thinned: true, counts: { sampled: 1300, flood: 400, recurringFlood: 400, water: 500 } });
  });

  it.each([399, 400, 401])("handles %i flood detections with zero or one remaining slot", (length) => {
    const result = nearMe([...points("flood", length), sample("water")], place);
    expect(result.samples).toHaveLength(400);
    expect(result.samples.filter((point) => point.kind === "flood")).toHaveLength(Math.min(length, 400));
    expect(result.thinned).toBe(length >= 400);
  });

  it.each([0, 3000, 6001])("sends only national flood kinds with even decimation for %i detections", (length) => {
    const priority = Array.from({ length }, (_, i) => sample(i % 2 ? "recurring-flood" : "flood", i));
    const result = nationalSamples([...points("dry", 100), ...points("water", 100), ...points("insufficient-data", 100), sample("no-data"), ...priority]);
    expect(result).toEqual({ sampleCap: 3000, thinned: length > 3000, samples: length <= 3000
      ? priority.map(rounded) : Array.from({ length: 3000 }, (_, i) => rounded(priority[Math.floor(i * (length - 1) / 2999)])) });
  });
});

it.each([
  { flood: 2, recurringFlood: 2, insufficientData: 0, noData: 0, sampled: 100, verdict: "not-seen" },
  { flood: 2, recurringFlood: 3, insufficientData: 0, noData: 0, sampled: 100, verdict: "flood" },
  { flood: 0, recurringFlood: 0, insufficientData: 24, noData: 25, sampled: 100, verdict: "not-seen" },
  { flood: 0, recurringFlood: 0, insufficientData: 25, noData: 25, sampled: 100, verdict: "cloud-or-no-data" },
  { flood: 2, recurringFlood: 3, insufficientData: 50, noData: 0, sampled: 100, verdict: "flood" },
  { flood: 2, recurringFlood: 2, insufficientData: 50, noData: 0, sampled: 100, verdict: "cloud-or-no-data" },
  { flood: 0, recurringFlood: 0, insufficientData: 1, noData: 0, sampled: 2000, verdict: "not-seen" },
  { flood: 0, recurringFlood: 0, insufficientData: 1336, noData: 0, sampled: 2116, verdict: "cloud-or-no-data" },
])("applies near-me thresholds to $flood flood + $recurringFlood recurring, $insufficientData insufficient + $noData missing / $sampled sampled", (counts) => {
  const place = { lat: 18.79, lon: 98.98 };
  const samples: FloodSample[] = [];
  for (const [kind, count] of [
    ["flood", counts.flood], ["recurring-flood", counts.recurringFlood],
    ["insufficient-data", counts.insufficientData], ["no-data", counts.noData],
    ["dry", counts.sampled - counts.flood - counts.recurringFlood - counts.insufficientData - counts.noData],
  ] as const) {
    samples.push(...Array.from({ length: count }, () => ({ ...place, provinceId: "chiang-mai", kind })));
  }
  expect(nearMe(samples, place)).toMatchObject({ verdict: counts.verdict, counts: {
    flood: counts.flood, recurringFlood: counts.recurringFlood, insufficientData: counts.insufficientData,
    noData: counts.noData, sampled: counts.sampled,
  } });
});

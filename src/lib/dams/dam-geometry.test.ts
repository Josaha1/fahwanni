import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BufferGeometry, NoColorSpace, RepeatWrapping, SRGBColorSpace } from "three";
import {
  concreteMaps, crestStrip, extrudeFootprint, gateBays, localMetres, profileFor, reservoirShape,
  type Coordinate, type DamGeometryData, type ReservoirRing,
} from "./dam-geometry";
import { damRegistryById } from "./registry";

const origin = { lat: 17, lon: 99 };
const coordinate = (x: number, z: number): Coordinate => [
  origin.lon + x / (6371008.8 * Math.PI / 180 * Math.cos(origin.lat * Math.PI / 180)),
  origin.lat - z / (6371008.8 * Math.PI / 180),
];
const data: DamGeometryData = { footprint: null, height: 100, crestLength: null, damType: "gravity", reservoir: null };
const real = (id: string): DamGeometryData => JSON.parse(readFileSync(
  new URL(`../../../public/data/dam-geo/${id}.json`, import.meta.url), "utf8"));

function validGeometry(geometry: BufferGeometry) {
  const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
  expect(positions.count).toBeGreaterThan(0);
  expect(normals.count).toBe(positions.count);
  for (const value of positions.array) expect(Number.isFinite(value)).toBe(true);
  for (let i = 0; i < normals.count; i++) {
    expect(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i))).toBeCloseTo(1, 5);
  }
  const indices = geometry.index?.array;
  if (indices) for (const index of indices) expect(index).toBeLessThan(positions.count);
  geometry.computeBoundingBox();
}

it("converts lon,lat to metres at the registry origin with east/right and north/back", () => {
  expect(localMetres([99, 17], origin)).toEqual([0, -0]);
  const point = localMetres(coordinate(100, -200), origin);
  expect(point[0]).toBeCloseTo(100, 6); expect(point[1]).toBeCloseTo(-200, 6);
});

it("provides concrete arch/gravity and darker 2.5:1 fill profiles, marking unknown types", () => {
  expect(profileFor("arch")).toMatchObject({ curved: true, upstreamSlope: 0, downstreamSlope: 0.1, estimated: false });
  expect(profileFor("gravity")).toMatchObject({ curved: false, upstreamSlope: 0.05, downstreamSlope: 0.75 });
  for (const type of ["earth", "rockfill"]) {
    const profile = profileFor(type);
    expect(profile).toMatchObject({ upstreamSlope: 2.5, downstreamSlope: 2.5, estimated: false });
    expect(parseInt(profile.material.color.slice(1), 16)).toBeLessThan(parseInt(profileFor("gravity").material.color.slice(1), 16));
  }
  expect(profileFor("arch-gravity")).toMatchObject({ curved: true, downstreamSlope: 0.75 });
  for (const type of [null, "unsupported"]) expect(profileFor(type)).toMatchObject({ type: "gravity", estimated: true });
});

describe("real dam footprints", () => {
  it("extracts a single curved Bhumibol crest from the area instead of extruding its perimeter", () => {
    const source = real("200101"), registry = damRegistryById.get("200101")!;
    const dam = extrudeFootprint(source, registry);
    expect(dam).toMatchObject({ height: 154, estimated: false, profile: { type: "arch" } });
    expect(dam.crest.length).toBeGreaterThan(2);
    const first = dam.crest[0].center, last = dam.crest.at(-1)!.center;
    expect(Math.hypot(first[0] - last[0], first[1] - last[1])).toBeGreaterThan(400);
    const deviation = Math.max(...dam.crest.map(({ center: p }) => Math.abs(
      (last[0] - first[0]) * (p[1] - first[1]) - (last[1] - first[1]) * (p[0] - first[0]),
    ) / Math.hypot(last[0] - first[0], last[1] - first[1])));
    expect(deviation).toBeGreaterThan(20);
    expect(dam.crest.every((section) => section.width > 0)).toBe(true);
    validGeometry(dam.geometry!);
    expect(dam.geometry!.boundingBox!.max.y).toBe(154);
    const water = reservoirShape(source.reservoir, registry)!;
    validGeometry(water);
    expect(water.boundingBox!.max.y).toBeCloseTo(0, 6);
    dam.geometry!.dispose(); water.dispose();
  });

  it("uses Sirikit's polygon length/width and defaults its missing type without inventing a reservoir", () => {
    const source = real("200102"), dam = extrudeFootprint(source, damRegistryById.get("200102")!);
    expect(source.damType).toBeNull();
    expect(dam).toMatchObject({ height: 113.6, estimated: true, profile: { type: "gravity" } });
    expect(dam.crest).toHaveLength(2);
    expect(Math.hypot(dam.crest[1].center[0] - dam.crest[0].center[0],
      dam.crest[1].center[1] - dam.crest[0].center[1])).toBeGreaterThan(500);
    expect(dam.crest[0].width).toBeGreaterThan(20);
    validGeometry(dam.geometry!);
    expect(reservoirShape(source.reservoir, origin)).toBeNull();
    dam.geometry!.dispose();
  });
});

it("uses the long PCA axis and transverse width of a rotated area, independently of winding", () => {
  const angle = 0.6, rotate = (x: number, z: number) => coordinate(
    x * Math.cos(angle) - z * Math.sin(angle), x * Math.sin(angle) + z * Math.cos(angle));
  const footprint = [rotate(-200, -10), rotate(200, -10), rotate(200, 10), rotate(-200, 10), rotate(-200, -10)];
  for (const ring of [footprint, footprint.toReversed()]) {
    const dam = extrudeFootprint({ ...data, footprint: ring }, origin);
    expect(dam.crest[0].width).toBeCloseTo(20, 4);
    expect(Math.hypot(dam.crest[1].center[0] - dam.crest[0].center[0],
      dam.crest[1].center[1] - dam.crest[0].center[1])).toBeCloseTo(400, 2);
    validGeometry(dam.geometry!); dam.geometry!.dispose();
  }
});

it("keeps an open footprint as the crest itself, including bends", () => {
  const footprint = [coordinate(-100, 0), coordinate(0, 30), coordinate(100, 0)];
  const dam = extrudeFootprint({ ...data, footprint }, origin);
  expect(dam.estimated).toBe(false);
  expect(dam.crest).toHaveLength(3);
  expect(dam.crest[1].center[1]).toBeCloseTo(30, 6);
  validGeometry(dam.geometry!); dam.geometry!.dispose();
});

it.each([null, 720])("makes an estimated straight wall of crestLength %s or 300m", (crestLength) => {
  const dam = extrudeFootprint({ ...data, crestLength }, origin);
  expect(dam.estimated).toBe(true);
  expect(dam.crest.map((s) => s.center)).toEqual([[-(crestLength ?? 300) / 2, 0], [(crestLength ?? 300) / 2, 0]]);
  validGeometry(dam.geometry!); dam.geometry!.dispose();
});

it.each([null, [coordinate(-100, 0), coordinate(100, 0)]])("keeps missing height null for footprint %s", (footprint) => {
  const dam = extrudeFootprint({ ...data, footprint, height: null }, origin);
  expect(dam.height).toBeNull(); expect(dam.geometry).toBeNull(); expect(crestStrip(dam)).toBeNull();
  expect(dam.crest).toHaveLength(2);
});

it.each(["arch", "gravity", "earth", "rockfill"])("extrudes the %s face slopes and outward normals", (damType) => {
  const dam = extrudeFootprint({ ...data, damType }, origin), geometry = dam.geometry!;
  validGeometry(geometry);
  const slopes = dam.profile.upstreamSlope + dam.profile.downstreamSlope;
  expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeCloseTo(8 + 100 * slopes, 5);
  const p = geometry.getAttribute("position"), n = geometry.getAttribute("normal");
  for (let i = 0; i < p.count; i += 3) {
    if (p.getY(i) === 100 && p.getY(i + 1) === 100 && p.getY(i + 2) === 100) expect(n.getY(i)).toBe(1);
    if (p.getY(i) === 0 && p.getY(i + 1) === 0 && p.getY(i + 2) === 0) expect(n.getY(i)).toBe(-1);
  }
  geometry.dispose();
});

it("points the steep upstream face towards the supplied reservoir", () => {
  const coordinates = [coordinate(-100, -100), coordinate(100, -100), coordinate(100, -50), coordinate(-100, -100)];
  const dam = extrudeFootprint({ ...data, reservoir: [{ role: "outer", coordinates }] }, origin);
  expect(dam.upstreamSign).toBe(-1);
  dam.geometry!.computeBoundingBox();
  expect(dam.geometry!.boundingBox!.min.z).toBeCloseTo(-9);
  expect(dam.geometry!.boundingBox!.max.z).toBeCloseTo(79);
  dam.geometry!.dispose();
});

it("adds a road and two raised parapets following the crest", () => {
  const dam = extrudeFootprint(real("200101"), damRegistryById.get("200101")!);
  const strip = crestStrip(dam)!;
  validGeometry(strip.road);
  expect(strip.road.boundingBox!.min.y).toBe(154);
  expect(strip.parapets).toHaveLength(2);
  for (const parapet of strip.parapets) {
    validGeometry(parapet);
    expect(parapet.boundingBox!.max.y).toBeCloseTo(155.15, 4);
    parapet.dispose();
  }
  strip.road.dispose(); dam.geometry!.dispose();
});

it("returns exactly n independent symbolic gate bays, including zero", () => {
  expect(gateBays(0)).toEqual({ symbolic: true, bays: [] });
  const gates = gateBays(4);
  expect(gates.symbolic).toBe(true); expect(gates.bays).toHaveLength(4);
  const centers = gates.bays.map((bay) => {
    validGeometry(bay);
    const box = bay.boundingBox!;
    bay.dispose(); return (box.min.x + box.max.x) / 2;
  });
  centers.forEach((center, i) => expect(center).toBeCloseTo(i - 1.5, 6));
  for (const n of [-1, 1.5, NaN, Infinity]) expect(() => gateBays(n)).toThrow(RangeError);
});

it("triangulates concave shorelines, islands and disjoint outers without filling the holes", () => {
  const ring = (role: string, points: number[][]): ReservoirRing => ({ role, coordinates: points.map(([x, z]) => coordinate(x, z)) });
  const rings = [ring("outer", [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10], [0, 0]]),
    ring("inner", [[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]),
    ring("outer", [[20, 0], [30, 0], [30, 10], [20, 10], [20, 0]]),
    ring("inner", [[22, 2], [24, 2], [24, 4], [22, 4], [22, 2]])];
  for (const source of [rings, rings.map((r) => ({ ...r, coordinates: r.coordinates.toReversed() }))]) {
    const geometry = reservoirShape(source, origin)!;
    validGeometry(geometry);
    const positions = geometry.getAttribute("position"), indices = geometry.index!;
    let area = 0;
    for (let i = 0; i < indices.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map((j) => indices.getX(i + j));
      area += Math.abs((positions.getX(b) - positions.getX(a)) * (positions.getZ(c) - positions.getZ(a))
        - (positions.getZ(b) - positions.getZ(a)) * (positions.getX(c) - positions.getX(a))) / 2;
    }
    expect(area).toBeCloseTo(64 - 4 + 100 - 4, 4);
    expect(positions.count).toBeGreaterThan(8);
    for (let i = 0; i < positions.count; i++) expect(geometry.getAttribute("normal").getY(i)).toBe(1);
    geometry.dispose();
  }
  expect(reservoirShape([], origin)).toBeNull();
});

it("generates deterministic concrete streak/joint and roughness maps without browser APIs", () => {
  const a = concreteMaps(64), b = concreteMaps(64);
  expect(a.map.image.data).toEqual(b.map.image.data);
  expect(a.roughnessMap.image.data).toEqual(b.roughnessMap.image.data);
  expect(a.map.image.data).not.toBe(b.map.image.data);
  expect(a.map.image).toMatchObject({ width: 64, height: 64 });
  expect(a.map.colorSpace).toBe(SRGBColorSpace); expect(a.roughnessMap.colorSpace).toBe(NoColorSpace);
  expect(a.map.wrapS).toBe(RepeatWrapping); expect(a.map.wrapT).toBe(RepeatWrapping);
  const pixels = a.map.image.data!;
  expect(pixels[0]).toBeLessThan(pixels[(3 * 64 + 3) * 3] - 20);
  expect(pixels[(3 * 64 + 3) * 3]).not.toBe(pixels[(20 * 64 + 3) * 3]);
  expect(new Set(pixels).size).toBeGreaterThan(20);
  for (const maps of [a, b]) { maps.map.dispose(); maps.roughnessMap.dispose(); }
  for (const size of [0, -1, 1.5, NaN, Infinity]) expect(() => concreteMaps(size)).toThrow(RangeError);
});

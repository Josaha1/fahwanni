import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import { BASE } from "./base-style";
import { translator } from "@/i18n/core";
import {
  buildings3dLayer, depthColor, depthPresets, floodProbeLines, floodWaterLayer, floorReached,
  modeBAllowed, terrariumDecode, waterGrid, wetBandLayer,
} from "./flood-sim";

describe("waterGrid", () => {
  const bounds = { west: 100.5, south: 13.7, east: 100.51, north: 13.71 };

  it("makes closed counter-clockwise rectangles with metre-sized cells and clipped edges", () => {
    const grid = waterGrid(bounds);
    expect(grid.type).toBe("FeatureCollection");
    expect(grid.features).toHaveLength(25);
    for (const feature of grid.features) {
      expect(feature.type).toBe("Feature");
      expect(feature.properties).toEqual({});
      expect(feature.geometry.type).toBe("Polygon");
      const [bl, br, tr, tl, closing] = feature.geometry.coordinates[0];
      expect(closing).toEqual(bl);
      expect(br[0]).toBeGreaterThan(bl[0]);
      expect(tl[1]).toBeGreaterThan(bl[1]);
      expect(tr).toEqual([br[0], tl[1]]);
      expect(br[1]).toBe(bl[1]);
      expect(tl[0]).toBe(bl[0]);
      for (const [lon, lat] of feature.geometry.coordinates[0]) {
        expect(lon).toBeGreaterThanOrEqual(bounds.west);
        expect(lon).toBeLessThanOrEqual(bounds.east);
        expect(lat).toBeGreaterThanOrEqual(bounds.south);
        expect(lat).toBeLessThanOrEqual(bounds.north);
      }
    }
    const [bl, br, , tl] = grid.features[0].geometry.coordinates[0];
    expect((br[0] - bl[0]) * 111_320 * Math.cos(13.705 * Math.PI / 180)).toBeCloseTo(250);
    expect((tl[1] - bl[1]) * 111_320).toBeCloseTo(250);
    const last = grid.features.at(-1)!.geometry.coordinates[0];
    expect(last[2]).toEqual([bounds.east, bounds.north]);
    expect(waterGrid(bounds)).toEqual(grid);
    expect(bounds).toEqual({ west: 100.5, south: 13.7, east: 100.51, north: 13.71 });
  });

  it.each([1, 7, 400])("enlarges cells to respect a cap of %s without gaps", (cap) => {
    const view = { west: 99, south: 12, east: 102, north: 16 };
    const grid = waterGrid(view, 250, cap);
    expect(grid.features.length).toBeGreaterThan(0);
    expect(grid.features.length).toBeLessThanOrEqual(cap);
    let area = 0;
    for (const { geometry } of grid.features) {
      const [bl, br, , tl] = geometry.coordinates[0];
      area += (br[0] - bl[0]) * (tl[1] - bl[1]);
    }
    expect(area).toBeCloseTo(12, 8);
  });

  it("accepts custom cell sizes and narrow views", () => {
    expect(waterGrid(bounds, 500).features).toHaveLength(9);
    expect(waterGrid({ ...bounds, east: bounds.west + 0.00001 }, 250, 2).features.length).toBeLessThanOrEqual(2);
  });

  it("unwraps antimeridian bounds and returns empty collections for zero area", () => {
    const grid = waterGrid({ west: 179.99, south: 0, east: -179.99, north: 0.01 });
    expect(grid.features[0].geometry.coordinates[0][0]).toEqual([179.99, 0]);
    expect(grid.features.at(-1)!.geometry.coordinates[0][2]).toEqual([180.01, 0.01]);
    expect(waterGrid({ ...bounds, east: bounds.west }).features).toEqual([]);
    expect(waterGrid({ ...bounds, north: bounds.south }).features).toEqual([]);
  });

  it("rejects invalid bounds and limits", () => {
    for (const invalid of [
      { ...bounds, west: NaN }, { ...bounds, east: Infinity },
      { ...bounds, south: -91 }, { ...bounds, north: 91 }, { ...bounds, north: 12 },
    ]) expect(() => waterGrid(invalid)).toThrow(RangeError);
    for (const size of [0, -1, NaN, Infinity]) expect(() => waterGrid(bounds, size)).toThrow(RangeError);
    for (const cap of [0, -1, 1.5, NaN, Infinity]) expect(() => waterGrid(bounds, 250, cap)).toThrow(RangeError);
  });
});

describe("floorReached", () => {
  it.each([
    [-1, 0, 0], [0, 0, 0], [0.099, 0, 0], [0.1, 1, 0.1 / 3],
    [0.5, 1, 1 / 6], [2.99, 1, 2.99 / 3], [3, 2, 0], [3.2, 2, 0.2 / 3], [6, 3, 0],
  ])("depth %s → floor %s", (depth, floor, fraction) => {
    const result = floorReached(depth);
    expect(result.floor).toBe(floor);
    expect(result.fraction).toBeCloseTo(fraction);
  });

  it("uses custom floor heights and rejects invalid inputs", () => {
    expect(floorReached(4.5, 2)).toEqual({ floor: 3, fraction: 0.25 });
    for (const depth of [NaN, Infinity, -Infinity]) expect(() => floorReached(depth)).toThrow(RangeError);
    for (const height of [0, -1, NaN, Infinity]) expect(() => floorReached(1, height)).toThrow(RangeError);
  });
});

describe("floodProbeLines", () => {
  const data = { depth: 0.25, buildingHeight: null, groundElevation: null, terrainOn: false };
  const t = translator("th");

  it("preserves slider precision and explains missing terrain without inventing building heights", () => {
    expect(floodProbeLines(data, t)).toEqual([
      "น้ำลึก 0.25 ม. จากพื้น (จำลอง)", "ไม่มีข้อมูลความสูงของอาคารนี้ใน OpenStreetMap", "ความสูงพื้นดิน: —",
      "เปิดแผนที่ 3 มิติเพื่อดูความสูงพื้น", "ภาพจำลองสมมติ ไม่ใช่การพยากรณ์",
    ]);
  });

  it("uses floorReached boundaries and estimates building floors and submerged height", () => {
    expect(floodProbeLines({ ...data, depth: 3, buildingHeight: 9, groundElevation: -1.5, terrainOn: true }, t)).toEqual([
      "น้ำลึก 3 ม. จากพื้น (จำลอง)", "ถึงชั้น 2", "อาคารสูง ~9 ม. (~3 ชั้น)",
      "น้ำท่วมอาคารนี้ 33% ของความสูง", "ความสูงพื้นดิน: -1.5 ม.", "ภาพจำลองสมมติ ไม่ใช่การพยากรณ์",
    ]);
  });

  it.each([5, undefined, null, 0, -1, NaN, Infinity])("explains unavailable or default building height %s without floors or percentages", (buildingHeight) => {
    expect(floodProbeLines({ ...data, buildingHeight }, t)).toEqual(floodProbeLines(data, t));
  });

  it.each([
    [0.25, 100, "<1"], [0.0001, 100, "<1"], [0.999, 100, "<1"],
    [1, 100, "1"], [1.49, 100, "1"], [1.5, 100, "2"],
    [1, 4.99, "20"], [1, 5.01, "20"],
  ])("formats depth %s over height %s as %s%%", (depth, buildingHeight, pct) => {
    expect(floodProbeLines({ ...data, depth, buildingHeight }, t)).toContain(`น้ำท่วมอาคารนี้ ${pct}% ของความสูง`);
  });

  it("caps submerged height at 100%, keeps at least one floor, and handles dry ground", () => {
    expect(floodProbeLines({ ...data, depth: 5, buildingHeight: 1 }, t)).toContain("น้ำท่วมอาคารนี้ 100% ของความสูง");
    const dry = floodProbeLines({ ...data, depth: 0, buildingHeight: 1 }, t);
    expect(dry).toContain("ถึงชั้น 0");
    expect(dry).toContain("อาคารสูง ~1 ม. (~1 ชั้น)");
    expect(dry).toContain("น้ำท่วมอาคารนี้ 0% ของความสูง");
  });

  it.each([null, NaN, Infinity])("shows a dash for unavailable terrain elevation %s", (groundElevation) => {
    expect(floodProbeLines({ ...data, terrainOn: true, groundElevation }, t)).toEqual([
      "น้ำลึก 0.25 ม. จากพื้น (จำลอง)", "ไม่มีข้อมูลความสูงของอาคารนี้ใน OpenStreetMap", "ความสูงพื้นดิน: —", "ภาพจำลองสมมติ ไม่ใช่การพยากรณ์",
    ]);
  });

  it("ignores terrain readings when terrain is off and accepts sea-level zero", () => {
    expect(floodProbeLines({ ...data, groundElevation: 100 }, t)).toEqual(floodProbeLines(data, t));
    expect(floodProbeLines({ ...data, terrainOn: true, groundElevation: 0 }, t)).toContain("ความสูงพื้นดิน: 0 ม.");
  });

  it("translates every flood card line into English", () => {
    expect(floodProbeLines({ ...data, buildingHeight: 10 }, translator("en"))).toEqual([
      "Water depth 0.25 m above ground (simulated)", "Reaches floor 1", "Building height ~10 m (~3 floors)",
      "Water covers 3% of this building's height", "Ground elevation: —",
      "Enable the 3D map to see ground elevation", "Hypothetical simulation, not a forecast",
    ]);
  });

  it.each([5, undefined, null])("translates missing building height %s into English", (buildingHeight) => {
    expect(floodProbeLines({ ...data, buildingHeight }, translator("en"))).toEqual([
      "Water depth 0.25 m above ground (simulated)", "No height data for this building in OpenStreetMap", "Ground elevation: —",
      "Enable the 3D map to see ground elevation", "Hypothetical simulation, not a forecast",
    ]);
    expect(floodProbeLines({ ...data, buildingHeight: 100 }, translator("en"))).toContain("Water covers <1% of this building's height");
  });
});

describe("terrariumDecode", () => {
  it.each([
    [128, 0, 0, 0], [128, 12, 128, 12.5], [127, 255, 128, -0.5],
    [0, 0, 0, -32768], [255, 255, 255, 32767.99609375],
  ])("decodes RGB (%s, %s, %s)", (r, g, b, expected) => {
    expect(terrariumDecode(r, g, b)).toBe(expected);
  });
});

describe("depthColor", () => {
  it.each([
    [0, [186, 230, 253, 0]], [0.3, [125, 211, 252, 140]], [1, [56, 189, 248, 140]],
    [2, [37, 99, 235, 140]], [5, [30, 58, 138, 140]],
    [0.15, [156, 221, 253, 140]], [0.65, [91, 200, 250, 140]],
    [1.5, [47, 144, 242, 140]], [3.5, [34, 79, 187, 140]],
  ])("uses the ramp at %s m", (depth, color) => expect(depthColor(depth)).toEqual(color));

  it("clamps dry and deeper values", () => {
    expect(depthColor(-1)).toEqual(depthColor(0));
    expect(depthColor(10)).toEqual(depthColor(5));
  });
});

describe("modeBAllowed", () => {
  it.each([
    [0, 7.99, 12, false], [0, 8, 11.99, false], [0, 8, 12, true],
    [-3, 5, 14, true], [100, 101, 16, false], [8, 0, 12, false],
    [NaN, 10, 12, false], [0, Infinity, 12, false], [0, 10, NaN, false],
  ])("gates elevations %s–%s at zoom %s", (min, max, zoom, expected) => {
    expect(modeBAllowed(min, max, zoom)).toBe(expected);
  });
});

it("provides the four short Thai depth presets", () => {
  expect(depthPresets).toEqual([
    { m: 0.3, label: "รถเก๋งเริ่มดับ" }, { m: 0.5, label: "ประมาณเข่า" },
    { m: 1, label: "ถึงชั้น 1" }, { m: 1.5, label: "ประมาณอก" },
  ]);
});

describe("layer builders", () => {
  it.each(["light", "dark"] as const)("styles %s buildings with OpenMapTiles heights", (theme) => {
    expect(buildings3dLayer(theme)).toMatchObject({
      type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 14,
      paint: {
        "fill-extrusion-color": BASE[theme].roadDim,
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 5],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
      },
    });
  });

  it("extrudes translucent water to the selected depth and caps wet bands at building height", () => {
    expect(floodWaterLayer(1)).toMatchObject({
      type: "fill-extrusion", source: "flood-grid",
      paint: { "fill-extrusion-height": 1, "fill-extrusion-base": 0, "fill-extrusion-color": "rgb(56, 189, 248)", "fill-extrusion-opacity": 0.55 },
    });
    expect(wetBandLayer(1)).toMatchObject({
      type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 14,
      paint: {
        "fill-extrusion-height": ["min", 1, ["coalesce", ["get", "render_height"], 5]],
        "fill-extrusion-base": ["min", 1, ["coalesce", ["get", "render_min_height"], 0]],
        "fill-extrusion-color": "#1e3a8a",
      },
    });
    for (const depth of [0, -1]) {
      expect(floodWaterLayer(depth).paint?.["fill-extrusion-height"]).toBe(0);
      expect(floodWaterLayer(depth).paint?.["fill-extrusion-opacity"]).toBe(0);
      expect(wetBandLayer(depth).paint?.["fill-extrusion-opacity"]).toBe(0);
    }
  });

  it.each([0, 0.3, 1, 5])("returns valid plain MapLibre layer specs at %s m", (depth) => {
    const layers = [buildings3dLayer("light"), buildings3dLayer("dark"), floodWaterLayer(depth), wetBandLayer(depth)];
    for (const layer of layers) {
      expect(JSON.parse(JSON.stringify(layer))).toEqual(layer);
      expect(validateStyleMin({
        version: 8,
        sources: {
          openmaptiles: { type: "vector", tiles: ["https://example.com/{z}/{x}/{y}.pbf"] },
          "flood-grid": { type: "geojson", data: waterGrid({ west: 100, south: 13, east: 100.01, north: 13.01 }) },
        },
        layers: [layer],
      })).toEqual([]);
    }
  });
});

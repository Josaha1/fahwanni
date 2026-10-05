import type { FeatureCollection, Polygon } from "geojson";
import type { FillExtrusionLayerSpecification } from "maplibre-gl";
import { BASE, type BaseTheme } from "./base-style";
import { intlOf, type T } from "@/i18n/core";

/**
 * Rectangles clipped to the view, using metres per degree at its middle latitude.
 * Cells start at cellM and grow together until their count is at most maxCells.
 * East < west crosses the antimeridian; coordinates then continue beyond 180°.
 * Empty bounds return no cells; invalid bounds or cell limits throw RangeError.
 */
export function waterGrid(
  bounds: { west: number; south: number; east: number; north: number },
  cellM = 250,
  maxCells = 400,
): FeatureCollection<Polygon> {
  const { west, south, north } = bounds;
  const east = bounds.east < west ? bounds.east + 360 : bounds.east;
  if (!Object.values(bounds).every(Number.isFinite) || south < -90 || north > 90 || north < south ||
    east < west || east - west > 360 || !Number.isFinite(cellM) || cellM <= 0 ||
    !Number.isInteger(maxCells) || maxCells < 1) throw new RangeError("Invalid water grid bounds or cell limits");
  const result: FeatureCollection<Polygon> = { type: "FeatureCollection", features: [] };
  if (east === west || north === south) return result;

  const metresPerLat = 111_320;
  const metresPerLon = metresPerLat * Math.cos(((south + north) / 2) * Math.PI / 180);
  const widthM = (east - west) * metresPerLon;
  const heightM = (north - south) * metresPerLat;
  let size = cellM;
  let cols = Math.ceil(widthM / size), rows = Math.ceil(heightM / size);
  while (cols * rows > maxCells) {
    size *= Math.max(1.1, Math.sqrt(cols * rows / maxCells));
    cols = Math.ceil(widthM / size);
    rows = Math.ceil(heightM / size);
  }
  for (let row = 0; row < rows; row++) {
    const bottom = south + row * size / metresPerLat;
    const top = Math.min(north, south + (row + 1) * size / metresPerLat);
    for (let col = 0; col < cols; col++) {
      const left = west + col * size / metresPerLon;
      const right = Math.min(east, west + (col + 1) * size / metresPerLon);
      result.features.push({
        type: "Feature", properties: {},
        geometry: { type: "Polygon", coordinates: [[[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]]] },
      });
    }
  }
  return result;
}

/**
 * Below 0.1 m (including negative depths): { floor: 0, fraction: 0 }.
 * Otherwise floor is 1-based and fraction is the submerged share of that floor
 * (0–<1). At exactly 3 m the default returns floor 2, fraction 0.
 * Non-finite depths or non-positive/non-finite floor heights throw RangeError.
 */
export function floorReached(depthM: number, floorM = 3): { floor: number; fraction: number } {
  if (!Number.isFinite(depthM) || !Number.isFinite(floorM) || floorM <= 0) throw new RangeError("Invalid depth or floor height");
  if (depthM < 0.1) return { floor: 0, fraction: 0 };
  const completed = Math.floor(depthM / floorM);
  return { floor: completed + 1, fraction: (depthM - completed * floorM) / floorM };
}

export type FloodProbeData = { depth: number; buildingHeight?: number | null; groundElevation: number | null; terrainOn: boolean };

export function floodProbeLines({ depth, buildingHeight, groundElevation, terrainOn }: FloodProbeData, t: T): string[] {
  const number = new Intl.NumberFormat(intlOf(t), { maximumFractionDigits: 2 });
  const lines = [
    t("น้ำลึก {d} ม. จากพื้น (จำลอง)", { d: number.format(Math.max(0, depth)) }),
  ];
  // OpenMapTiles uses 5 m when OSM has no height or levels; it cannot establish a real height.
  if (buildingHeight != null && Number.isFinite(buildingHeight) && buildingHeight > 0 && buildingHeight !== 5) {
    const pct = Math.min(100, Math.max(0, depth) / buildingHeight * 100);
    lines.push(
      t("ถึงชั้น {floor}", { floor: floorReached(depth).floor }),
      t("อาคารสูง ~{h} ม. (~{floors} ชั้น)", { h: number.format(buildingHeight), floors: Math.max(1, Math.round(buildingHeight / 3)) }),
      t("น้ำท่วมอาคารนี้ {pct}% ของความสูง", { pct: pct > 0 && pct < 1 ? "<1" : number.format(Math.round(pct)) }),
    );
  } else lines.push(t("ไม่มีข้อมูลความสูงของอาคารนี้ใน OpenStreetMap"));
  lines.push(t("ความสูงพื้นดิน: {h}", { h: terrainOn && groundElevation !== null && Number.isFinite(groundElevation)
    ? t("{d} ม.", { d: number.format(groundElevation) }) : "—" }));
  if (!terrainOn) lines.push(t("เปิดแผนที่ 3 มิติเพื่อดูความสูงพื้น"));
  lines.push(t("ภาพจำลองสมมติ ไม่ใช่การพยากรณ์"));
  return lines;
}

export function terrariumDecode(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

const DEPTH_STOPS = [
  [0, [186, 230, 253]], [0.3, [125, 211, 252]], [1, [56, 189, 248]],
  [2, [37, 99, 235]], [5, [30, 58, 138]],
] as const;

/** Linear RGB ramp at 0/0.3/1/2/5 m; RGBA bytes (alpha 140 ≈ 0.55), dry = transparent. */
export function depthColor(depthM: number): [number, number, number, number] {
  if (!(depthM > 0)) return [186, 230, 253, 0];
  for (let i = 1; i < DEPTH_STOPS.length; i++) {
    const [upper, color] = DEPTH_STOPS[i];
    if (depthM > upper) continue;
    const [lower, previous] = DEPTH_STOPS[i - 1];
    const fraction = (depthM - lower) / (upper - lower);
    return [
      Math.round(previous[0] + (color[0] - previous[0]) * fraction),
      Math.round(previous[1] + (color[1] - previous[1]) * fraction),
      Math.round(previous[2] + (color[2] - previous[2]) * fraction), 140,
    ];
  }
  return [30, 58, 138, 140];
}

export function modeBAllowed(elevMin: number, elevMax: number, zoom: number): boolean {
  return [elevMin, elevMax, zoom].every(Number.isFinite) && elevMax - elevMin >= 8 && zoom >= 12;
}

export const depthPresets = [
  { m: 0.3, label: "รถเก๋งเริ่มดับ" },
  { m: 0.5, label: "ประมาณเข่า" },
  { m: 1, label: "ถึงชั้น 1" },
  { m: 1.5, label: "ประมาณอก" },
] as const;

export function buildings3dLayer(theme: BaseTheme): FillExtrusionLayerSpecification {
  return {
    id: "buildings-3d", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 14,
    paint: {
      "fill-extrusion-color": BASE[theme].roadDim,
      "fill-extrusion-height": ["coalesce", ["get", "render_height"], 5],
      "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
    },
  };
}

export function floodWaterLayer(depth: number): FillExtrusionLayerSpecification {
  const [r, g, b] = depthColor(depth);
  return {
    id: "flood-water", type: "fill-extrusion", source: "flood-grid",
    paint: {
      "fill-extrusion-color": `rgb(${r}, ${g}, ${b})`, "fill-extrusion-opacity": depth > 0 ? 0.55 : 0,
      "fill-extrusion-height": Math.max(0, depth), "fill-extrusion-base": 0,
    },
  };
}

export function wetBandLayer(depth: number): FillExtrusionLayerSpecification {
  const height = Math.max(0, depth);
  return {
    id: "flood-wet-band", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 14,
    paint: {
      "fill-extrusion-color": "#1e3a8a", "fill-extrusion-opacity": depth > 0 ? 0.8 : 0,
      "fill-extrusion-height": ["min", height, ["coalesce", ["get", "render_height"], 5]],
      "fill-extrusion-base": ["min", height, ["coalesce", ["get", "render_min_height"], 0]],
    },
  };
}

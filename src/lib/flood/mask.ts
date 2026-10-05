import { provinceIdFromShapeName } from "../provinces";

type Point = [number, number];
type Polygon = Point[][];
export type ProvinceGeoJson = { type: "FeatureCollection"; features: Array<{
  properties: { shapeName: string; shapeISO: string };
  geometry: { type: "Polygon"; coordinates: Polygon } | { type: "MultiPolygon"; coordinates: Polygon[] };
}> };
export type ProvinceMask = { id: string; polygons: Polygon[]; bbox: [number, number, number, number] };

export function prepareProvinceMask(data: ProvinceGeoJson): ProvinceMask[] {
  const masks = data.features.map((feature) => {
    const id = provinceIdFromShapeName(feature.properties.shapeName);
    if (!id) throw new Error(`Unmatched province: ${feature.properties.shapeName}`);
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const bbox: ProvinceMask["bbox"] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const polygon of polygons) for (const ring of polygon) for (const [lon, lat] of ring) {
      bbox[0] = Math.min(bbox[0], lon); bbox[1] = Math.min(bbox[1], lat);
      bbox[2] = Math.max(bbox[2], lon); bbox[3] = Math.max(bbox[3], lat);
    }
    return { id, polygons, bbox };
  });
  if (masks.length !== 77 || new Set(masks.map((mask) => mask.id)).size !== 77) throw new Error("Thailand mask must contain 77 distinct provinces");
  return masks;
}

function inRing(lon: number, lat: number, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    // Include the outer boundary; a boundary of a hole is excluded by the caller.
    if ((xi !== xj || yi !== yj) && Math.abs((lon - xi) * (yj - yi) - (lat - yi) * (xj - xi)) < 1e-12
      && lon >= Math.min(xi, xj) && lon <= Math.max(xi, xj) && lat >= Math.min(yi, yj) && lat <= Math.max(yi, yj)) return true;
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function provinceIndexAt(lon: number, lat: number, masks: ProvinceMask[], previous = -1): number {
  const contains = (mask: ProvinceMask) => {
    const [west, south, east, north] = mask.bbox;
    if (lon < west || lon > east || lat < south || lat > north) return false;
    return mask.polygons.some(([outer, ...holes]) => inRing(lon, lat, outer) && !holes.some((hole) => inRing(lon, lat, hole)));
  };
  if (previous >= 0 && previous < masks.length && contains(masks[previous])) return previous;
  for (let i = 0; i < masks.length; i++) {
    if (i !== previous && contains(masks[i])) return i;
  }
  return -1;
}

export function provinceAt(lon: number, lat: number, masks: ProvinceMask[]): string | null {
  const index = provinceIndexAt(lon, lat, masks);
  return index < 0 ? null : masks[index].id;
}

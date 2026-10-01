/**
 * DDPM (ปภ.) village flood-risk points — catalog.disaster.go.th "Creative Commons Attributions", data last edited 2024.
 * Historical risk, not a current flood. Only levels 2–4 are served (0 none, 1 low are left out to keep the map readable).
 */
export type FloodRiskLevel = 2 | 3 | 4;
export interface FloodRiskPoint { id: string; lat: number; lon: number; level: FloodRiskLevel; village: string; tambon: string; amphoe: string; province: string }

export const FLOOD_RISK_LEVEL_WORDS: Record<FloodRiskLevel, string> = { 2: "ความเสี่ยงปานกลาง", 3: "ความเสี่ยงสูง", 4: "ความเสี่ยงสูงมาก" };
export const FLOOD_RISK_COLORS: Record<FloodRiskLevel, string> = { 2: "#E8B500", 3: "#F28C28", 4: "#D32F2F" };
/** Requests are snapped to this grid (degrees) so neighbouring views share the cache. */
export const FLOOD_RISK_CELL = 0.25;
export const FLOOD_RISK_MAX_SPAN = 1.5;
export const FLOOD_RISK_MIN_ZOOM = 9;

export type Bbox = [west: number, south: number, east: number, north: number];

/** Parses "w,s,e,n", snaps outward to the grid, and rejects boxes outside Thailand or larger than the span limit. */
export function parseRiskBbox(value: string | null): Bbox | null {
  const parts = (value ?? "").split(",").map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return null;
  const snap = (v: number, up: boolean) => (up ? Math.ceil : Math.floor)(v / FLOOD_RISK_CELL) * FLOOD_RISK_CELL;
  const box: Bbox = [snap(parts[0], false), snap(parts[1], false), snap(parts[2], true), snap(parts[3], true)];
  if (box[0] >= box[2] || box[1] >= box[3]) return null;
  if (box[2] - box[0] > FLOOD_RISK_MAX_SPAN || box[3] - box[1] > FLOOD_RISK_MAX_SPAN) return null;
  if (box[2] < 97 || box[0] > 106 || box[3] < 5.5 || box[1] > 21) return null;
  return box;
}

type Feature = { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> };

export function parseRiskFeatures(json: { features?: Feature[] }): FloodRiskPoint[] {
  return (json.features ?? []).flatMap((feature) => {
    const p = feature.properties ?? {};
    const level = Number(p.risk_level);
    const [lon, lat] = Array.isArray(feature.geometry?.coordinates) ? feature.geometry!.coordinates as number[] : [Number(p.long), Number(p.lat)];
    if (level !== 2 && level !== 3 && level !== 4 || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const text = (key: string) => typeof p[key] === "string" ? (p[key] as string).trim() : "";
    return [{ id: `ddpm:${p.village_co ?? p.OBJECTID ?? `${lat},${lon}`}`, lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5,
      level: level as FloodRiskLevel, village: text("mname"), tambon: text("tname"), amphoe: text("aname"), province: text("pname") }];
  });
}

import { damBand, damBandColor } from "./bands";
import { isStale, type DwrKind, type DwrReservoir } from "./dwr";

/** An OpenStreetMap dam from public/data/osm-dams.json (ODbL); no water data. */
export type OsmDam = { id: string; nameTh: string; nameEn: string; lat: number; lon: number };

/** Every dam/reservoir beyond RID's 35: DWR open data (with storage) and OSM locations. */
export type ReservoirPoint = {
  id: string;
  source: "dwr" | "osm";
  nameTh: string;
  nameEn: string;
  lat: number;
  lon: number;
  kind: DwrKind | "dam";
  owner: "RID" | "DWR" | "other" | null;
  capacityMcm: number | null;
  storageMcm: number | null;
  pct: number | null;
  measuredAt: string | null;
};

export const RESERVOIR_GREY = "#8a94a6";

export function buildReservoirPoints(dwr: DwrReservoir[], osm: OsmDam[]): ReservoirPoint[] {
  return [
    ...dwr.map((item) => ({
      id: `dwr:${item.code}`, source: "dwr" as const, nameTh: item.name, nameEn: "", lat: item.lat, lon: item.lon,
      kind: item.kind, owner: item.owner, capacityMcm: item.capacityMcm, storageMcm: item.storageMcm, pct: item.pct, measuredAt: item.measuredAt,
    })),
    ...osm.map((item) => ({
      id: `osm:${item.id}`, source: "osm" as const, nameTh: item.nameTh, nameEn: item.nameEn, lat: item.lat, lon: item.lon,
      kind: "dam" as const, owner: null, capacityMcm: null, storageMcm: null, pct: null, measuredAt: null,
    })),
  ];
}

/** Band colour only for a current reading with a known capacity; everything else is neutral grey. */
export function reservoirColor(point: ReservoirPoint, nowMs: number): string {
  return point.pct !== null && !isStale(point.measuredAt, nowMs) ? damBandColor(damBand(point.pct)) : RESERVOIR_GREY;
}

export function reservoirKindWord(kind: ReservoirPoint["kind"]): string {
  return kind === "weir" ? "ฝาย" : kind === "pond" ? "หนอง/บึง" : kind === "dam" ? "เขื่อน/ฝาย" : "อ่างเก็บน้ำ";
}

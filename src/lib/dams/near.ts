import type { DamsPayload } from "./client";
import { alongKm } from "./geo";
import type { DamPath, Downstream } from "./paths";
import type { StationSituation } from "./types";

export type DamDownstreamFile = { dams: Record<string, Downstream> };
export type UpstreamDam = {
  damId: string;
  nameTh: string;
  nameEn: string;
  kmToUser: number;
  storagePct: number | null;
  releaseCms: number | null;
  nearStation: {
    code: string; nameTh: string; situation: StationSituation | null; pctBank: number | null; km: number;
  } | null;
  reason: "storage" | "release" | "river";
};

export function upstreamDamsFor(
  place: { lat: number; lon: number },
  input: { paths: { type: "FeatureCollection"; features: DamPath[] }; downstream: DamDownstreamFile; dams: DamsPayload },
): UpstreamDam[] {
  const stationByCode = new Map(input.dams.stations.map((station) => [station.code, station]));
  const damById = new Map(input.dams.dams.map((dam) => [dam.id, dam]));
  const results: UpstreamDam[] = [];

  for (const path of input.paths.features) {
    const damId = path.properties.damId;
    const dam = damById.get(damId);
    const barrage = damId === "chao-phraya" ? input.dams.barrage : null;
    const downstream = input.downstream.dams[damId];
    if ((!dam && !barrage) || !downstream || path.geometry.coordinates.length < 2) continue;

    const { distanceKm, km } = alongKm([place.lon, place.lat], path.geometry.coordinates);
    if (distanceKm > 10 || km > 300) continue;

    const nearest = downstream.stations.reduce<(typeof downstream.stations)[number] | null>((best, station) =>
      stationByCode.has(station.code) && Math.abs(station.km - km) <= 30 &&
      (!best || Math.abs(station.km - km) < Math.abs(best.km - km))
        ? station : best, null);
    const station = nearest ? stationByCode.get(nearest.code) : undefined;
    const nearStation = nearest && station ? {
      code: station.code, nameTh: station.nameTh, situation: station.situation,
      pctBank: station.pctBank, km: nearest.km,
    } : null;
    const riverHigh = nearStation !== null && nearStation.situation !== null && nearStation.situation >= 4;
    const barrageHigh = barrage && (barrage.situation !== null && barrage.situation >= 4 || riverHigh);
    if (!dam && !barrageHigh) continue;
    if (dam && dam.storagePct <= 80 && !dam.highRelease && !riverHigh) continue;

    results.push({
      damId, nameTh: dam?.nameTh ?? barrage!.nameTh, nameEn: dam?.nameEn ?? barrage!.nameEn,
      kmToUser: km, storagePct: dam?.storagePct ?? null,
      releaseCms: dam?.releaseCms ?? barrage?.dischargeCms ?? null, nearStation,
      reason: dam?.storagePct !== undefined && dam.storagePct > 80 ? "storage"
        : dam?.highRelease ? "release" : "river",
    });
  }

  return results.sort((a, b) => a.kmToUser - b.kmToUser).slice(0, 2);
}

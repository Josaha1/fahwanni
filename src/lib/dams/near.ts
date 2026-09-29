import type { DamsPayload } from "./client";
import { alongKm } from "./geo";
import type { DamPath, Downstream } from "./paths";

export type DamDownstreamFile = { dams: Record<string, Downstream> };
export type UpstreamDam = {
  damId: string;
  nameTh: string;
  nameEn: string;
  kmToUser: number;
  storagePct: number;
  releaseCms: number | null;
  reason: "storage" | "release";
};

/** Dams upstream of a place (≤ 10 km from the route, ≤ 300 km downstream) that are > 80 % full or releasing a lot. */
export function upstreamDamsFor(
  place: { lat: number; lon: number },
  input: { paths: { type: "FeatureCollection"; features: DamPath[] }; downstream: DamDownstreamFile; dams: DamsPayload },
): UpstreamDam[] {
  const damById = new Map(input.dams.dams.map((dam) => [dam.id, dam]));
  const results: UpstreamDam[] = [];

  for (const path of input.paths.features) {
    const damId = path.properties.damId;
    const dam = damById.get(damId);
    if (!dam || !input.downstream.dams[damId] || path.geometry.coordinates.length < 2) continue;
    if (dam.storagePct <= 80 && !dam.highRelease) continue;

    const { distanceKm, km } = alongKm([place.lon, place.lat], path.geometry.coordinates);
    if (distanceKm > 10 || km > 300) continue;

    results.push({
      damId, nameTh: dam.nameTh, nameEn: dam.nameEn, kmToUser: km, storagePct: dam.storagePct,
      releaseCms: dam.releaseCms, reason: dam.storagePct > 80 ? "storage" : "release",
    });
  }

  return results.sort((a, b) => a.kmToUser - b.kmToUser).slice(0, 2);
}

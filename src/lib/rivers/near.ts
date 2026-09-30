import { distanceKm } from "../storms/normalize";
import type { Position } from "../storms/normalize";
import type { RiverStatus } from "./types";

/** A river point farther than this is not "near you" (Phuket → Surat Thani is ~170 km). */
export const NEAR_RIVER_KM = 120;

export type NearbyRiver = { id: string; lat: number; lon: number; summary: null | { today: { status: RiverStatus } } };

export function nearestRiverWithStatus<T extends NearbyRiver>(place: Position, points: T[]): T | null {
  return points.map((point) => ({ point, km: distanceKm(place, point) }))
    .filter(({ point, km }) => km <= NEAR_RIVER_KM && point.summary)
    .sort((a, b) => a.km - b.km || a.point.id.localeCompare(b.point.id))[0]?.point ?? null;
}

import "server-only";

import { distanceKm } from "../storms/normalize";
import { normalizeDwr, type DwrReservoir } from "./dwr";

const BASE = "https://api.dwr.go.th/twsapi/public/v1.0/";
const ENDPOINTS = ["MediumSizeWaterResourcesInfo", "MediumSizeWaterResources", "SmallSizeWaterResourcesInfo", "SmallSizeWaterResources"] as const;

export interface DwrPayload {
  fetchedAt: string;
  source: string;
  reservoirs: DwrReservoir[];
}

/** Reservoirs within this distance of an RID large dam are the same place; RID's daily report wins. */
const SAME_PLACE_KM = 2;

export function withoutRidDuplicates(reservoirs: DwrReservoir[], ridDams: { lat: number; lon: number }[]): DwrReservoir[] {
  return reservoirs.filter((reservoir) => !ridDams.some((dam) => distanceKm(reservoir, dam) < SAME_PLACE_KM));
}

/** Returns null when any of the four DWR endpoints fails; the route keeps serving its cache. */
export async function fetchDwr(ridDams: { lat: number; lon: number }[], fetchImpl: typeof fetch = fetch): Promise<DwrPayload | null> {
  try {
    const bodies = await Promise.all(ENDPOINTS.map(async (name) => {
      const response = await fetchImpl(`${BASE}${name}`, { next: { revalidate: 21600 }, signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`DWR ${name} ${response.status}`);
      return response.json();
    }));
    const [mediumInfo, medium, smallInfo, small] = bodies;
    const reservoirs = withoutRidDuplicates([
      ...normalizeDwr(mediumInfo, medium, "medium"), ...normalizeDwr(smallInfo, small, "small"),
    ], ridDams);
    if (!reservoirs.length) return null;
    return { fetchedAt: new Date().toISOString(), source: "กรมทรัพยากรน้ำ (DWR) open data · CC BY", reservoirs };
  } catch {
    return null;
  }
}

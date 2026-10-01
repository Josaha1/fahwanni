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

/** A DWR row is the same place as an RID large dam only when it is this close AND carries the dam's name; RID wins. */
const SAME_PLACE_KM = 2;

/** Distance alone is not enough: อ่างเก็บน้ำหนองบัว (อ.พังโคน) sits 1.7 km from เขื่อนน้ำอูน but is a different reservoir. */
export function withoutRidDuplicates(reservoirs: DwrReservoir[], ridDams: { lat: number; lon: number; nameTh?: string }[]): DwrReservoir[] {
  return reservoirs.filter((reservoir) => !ridDams.some((dam) => distanceKm(reservoir, dam) < SAME_PLACE_KM
    && Boolean(dam.nameTh) && reservoir.name.includes(dam.nameTh!)));
}

/** Returns null when any of the four DWR endpoints fails; the route keeps serving its cache. */
export async function fetchDwr(ridDams: { lat: number; lon: number; nameTh?: string }[], fetchImpl: typeof fetch = fetch): Promise<DwrPayload | null> {
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

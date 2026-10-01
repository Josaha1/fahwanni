import "server-only";

import { fetchJsonWithCa } from "../net/fetch-json-with-ca";
import { SECTIGO_DV_R36 } from "../net/sectigo-dv-r36";
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
export async function fetchDwr(ridDams: { lat: number; lon: number; nameTh?: string }[],
  getJson: (url: string) => Promise<unknown> = (url) => fetchJsonWithCa(url, [SECTIGO_DV_R36])): Promise<DwrPayload | null> {
  try {
    // DWR omits its intermediate certificate; plain fetch() fails in Node (UNABLE_TO_VERIFY_LEAF_SIGNATURE).
    const bodies = await Promise.all(ENDPOINTS.map((name) => getJson(`${BASE}${name}`))) as Parameters<typeof normalizeDwr>[0][];
    const [mediumInfo, medium, smallInfo, small] = bodies;
    const reservoirs = withoutRidDuplicates([
      ...normalizeDwr(mediumInfo, medium as never, "medium"), ...normalizeDwr(smallInfo, small as never, "small"),
    ], ridDams);
    if (!reservoirs.length) return null;
    return { fetchedAt: new Date().toISOString(), source: "กรมทรัพยากรน้ำ (DWR) open data · CC BY", reservoirs };
  } catch {
    return null;
  }
}

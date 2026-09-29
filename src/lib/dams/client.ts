import "server-only";

import { parseThaiWater } from "./thaiwater";
import type { Barrage, Dam, RiverStation } from "./types";

const URL = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/thailand_main";

export interface DamsPayload {
  dataDate: string | null;
  fetchedAt: string;
  stale: boolean;
  dams: Dam[];
  barrage: Barrage;
  stations: RiverStation[];
}

/** Returns null on upstream failure; the route may still serve cached data. */
export async function fetchDams(fetchImpl: typeof fetch = fetch): Promise<DamsPayload | null> {
  try {
    const response = await fetchImpl(URL, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return null;
    const raw: unknown = await response.json();
    const { dataDate, dams, barrage, stations } = parseThaiWater(raw);
    if (dams.length === 0) return null;
    const fetchedAt = new Date().toISOString();
    const dataTime = dataDate === null ? null : Date.parse(`${dataDate}T00:00:00+07:00`);
    return {
      dataDate, fetchedAt,
      stale: dataTime !== null && Date.parse(fetchedAt) - dataTime > 36 * 60 * 60 * 1000,
      dams, barrage, stations,
    };
  } catch {
    return null;
  }
}

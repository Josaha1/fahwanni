import "server-only";

import { parseRidDams } from "./rid";
import type { Barrage, Dam, RiverStation } from "./types";

/** RID's public large-dam report (35 dams, ~7 KB, daily). Docs: app.rid.go.th/reservoir/api/document/dam */
const URL = "https://app.rid.go.th/reservoir/api/dam/public";

export interface DamsPayload {
  dataDate: string | null;
  fetchedAt: string;
  stale: boolean;
  dams: Dam[];
  /** No source with published terms for the Chao Phraya barrage or river stations yet; kept empty. */
  barrage: Barrage;
  stations: RiverStation[];
}

/** Returns null on upstream failure; the route may still serve cached data. */
export async function fetchDams(fetchImpl: typeof fetch = fetch): Promise<DamsPayload | null> {
  try {
    const response = await fetchImpl(URL, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return null;
    const { dataDate, dams } = parseRidDams(await response.json());
    if (dams.length === 0) return null;
    const fetchedAt = new Date().toISOString();
    const dataTime = dataDate === null ? null : Date.parse(`${dataDate}T00:00:00+07:00`);
    return {
      dataDate, fetchedAt,
      // Daily report: stale once it is more than 36 h old.
      stale: dataTime !== null && Date.parse(fetchedAt) - dataTime > 36 * 60 * 60 * 1000,
      dams, barrage: null, stations: [],
    };
  } catch {
    return null;
  }
}

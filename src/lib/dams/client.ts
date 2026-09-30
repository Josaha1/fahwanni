import "server-only";

import { parseRidDams } from "./rid";
import type { Dam } from "./types";

/** RID's public large-dam report (35 dams, ~7 KB, daily). Docs: app.rid.go.th/reservoir/api/document/dam */
const URL = "https://app.rid.go.th/reservoir/api/dam/public";

export interface DamsPayload {
  dataDate: string | null;
  fetchedAt: string;
  stale: boolean;
  dams: Dam[];
}

/** Returns null on upstream failure; the route may still serve cached data. */
export async function fetchDams(fetchImpl: typeof fetch = fetch): Promise<DamsPayload | null> {
  try {
    const response = await fetchImpl(URL, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return null;
    const today = parseRidDams(await response.json());
    const { dataDate } = today;
    let dams = today.dams;
    if (dataDate && dams.length < today.registeredCount) {
      const dayStart = Date.parse(`${dataDate}T00:00:00Z`);
      if (Number.isFinite(dayStart) && new Date(dayStart).toISOString().slice(0, 10) === dataDate) {
        const previousDate = new Date(dayStart - 86_400_000).toISOString().slice(0, 10);
        try {
          const previousResponse = await fetchImpl(`${URL}/${previousDate}`, {
            next: { revalidate: 3600 }, signal: AbortSignal.timeout(20_000),
          });
          if (previousResponse.ok) {
            const previous = parseRidDams(await previousResponse.json());
            if (previous.dataDate === previousDate) {
              const currentIds = new Set(dams.map((dam) => dam.id));
              dams = [...dams, ...previous.dams.filter((dam) => !currentIds.has(dam.id))];
            }
          }
        } catch { /* Keep the current day's available dams if yesterday is unavailable. */ }
      }
    }
    if (dams.length === 0) return null;
    const fetchedAt = new Date().toISOString();
    const dataTime = dataDate === null ? null : Date.parse(`${dataDate}T00:00:00+07:00`);
    return {
      dataDate, fetchedAt,
      // Daily report: stale once it is more than 36 h old.
      stale: dataTime !== null && Date.parse(fetchedAt) - dataTime > 36 * 60 * 60 * 1000,
      dams,
    };
  } catch {
    return null;
  }
}

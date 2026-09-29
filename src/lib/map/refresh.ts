export const REFRESH = { radar: 5 * 60_000, slow: 60 * 60_000 };

export function shouldRefresh(lastFetchedMs: number | null, nowMs: number, maxAgeMs: number): boolean {
  return lastFetchedMs === null || nowMs - lastFetchedMs >= maxAgeMs;
}

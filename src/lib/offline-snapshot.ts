/** Times at which data shown on screen was saved by the service worker (offline fallback), keyed by URL. */
const cached = new Map<string, string>();
const listeners = new Set<() => void>();

export const CACHED_AT_HEADER = "x-fah-cached-at";

export function reportCached(url: string, savedAt: string | null): void {
  const before = cached.get(url) ?? null;
  if (savedAt && Number.isFinite(Date.parse(savedAt))) cached.set(url, savedAt); else cached.delete(url);
  if ((cached.get(url) ?? null) !== before) listeners.forEach((listener) => listener());
}

/** The oldest saved time among sources currently served from the offline cache, or null when all are live. */
export function oldestCachedAt(): string | null {
  let oldest: string | null = null;
  for (const value of cached.values()) if (oldest === null || Date.parse(value) < Date.parse(oldest)) oldest = value;
  return oldest;
}

export function subscribeCached(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

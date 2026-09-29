import "server-only";

import { toManifest } from "./rainviewer";
import type { RadarManifest } from "./types";

export async function fetchRadar(fetchImpl: typeof fetch = fetch, now: () => number = Date.now): Promise<RadarManifest> {
  const url = "https://api.rainviewer.com/public/weather-maps.json";
  const fetchManifest = async (options: RequestInit): Promise<RadarManifest> => {
    try {
      const response = await fetchImpl(url, options);
      return response.ok ? toManifest(await response.json()) : toManifest(null);
    } catch {
      return toManifest(null);
    }
  };
  const newestTime = (manifest: RadarManifest): number =>
    manifest.provider === "rainviewer" && manifest.frames.length
      ? Date.parse(manifest.frames[manifest.frames.length - 1].time)
      : -Infinity;

  let manifest = await fetchManifest({ next: { revalidate: 300 }, signal: AbortSignal.timeout(8_000) });
  if (now() - newestTime(manifest) > 20 * 60 * 1000) {
    const retry = await fetchManifest({ cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (newestTime(retry) > newestTime(manifest)) manifest = retry;
  }
  return manifest.provider === "rainviewer"
    ? { ...manifest, stale: now() - newestTime(manifest) > 30 * 60 * 1000 }
    : manifest;
}

import "server-only";

import { toManifest } from "./rainviewer";
import type { RadarManifest } from "./types";

export async function fetchRadar(fetchImpl: typeof fetch = fetch): Promise<RadarManifest> {
  try {
    const response = await fetchImpl("https://api.rainviewer.com/public/weather-maps.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return toManifest(null);
    return toManifest(await response.json());
  } catch {
    return toManifest(null);
  }
}

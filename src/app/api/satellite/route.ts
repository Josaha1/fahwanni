import { gibsTileUrl } from "@/lib/map/gibs";
import { WeatherCache } from "@/lib/weather/cache";

export type SatelliteTimes = { himawari: string | null; imerg: string | null };

const cache = new WeatherCache<SatelliteTimes>(() => Date.now(), 1, 10 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=600" };
const tile = { z: 2, y: 1, x: 3 };

export async function latestTileTime(layer: "Himawari_AHI_Band13_Clean_Infrared" | "IMERG_Precipitation_Rate_30min",
  now: number, startHours: number, endHours: number, stepMinutes: number): Promise<string | null> {
  const stepMs = stepMinutes * 60_000;
  for (let time = Math.floor((now - startHours * 3_600_000) / stepMs) * stepMs;
    time >= now - endHours * 3_600_000; time -= stepMs) {
    try {
      const iso = new Date(time).toISOString().replace(".000Z", "Z");
      const response = await fetch(gibsTileUrl(layer, iso, tile, "GoogleMapsCompatible_Level6"), {
        method: "HEAD", signal: AbortSignal.timeout(5_000), cache: "no-store",
      });
      if (response.status === 200 && response.headers.get("content-type")?.toLowerCase().startsWith("image/png")) {
        return iso;
      }
    } catch { /* A missing or timed-out tile is checked at the previous interval. */ }
  }
  return null;
}

export async function GET() {
  const fresh = cache.getFresh("satellite");
  if (fresh) return Response.json(fresh, { headers });
  const now = Date.now();
  const [himawari, imerg] = await Promise.all([
    latestTileTime("Himawari_AHI_Band13_Clean_Infrared", now, 1, 3, 10),
    latestTileTime("IMERG_Precipitation_Rate_30min", now, 5, 10, 30),
  ]);
  const times = { himawari, imerg };
  cache.set("satellite", times);
  return Response.json(times, { headers });
}

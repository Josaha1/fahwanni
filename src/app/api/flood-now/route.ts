import { after } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseLatLon } from "@/lib/geo";
import { prepareProvinceMask, type ProvinceGeoJson, type ProvinceMask } from "@/lib/flood/mask";
import { decodePalettePng } from "@/lib/flood/png";
import { countsByProvince, FLOOD_ATTRIBUTION, nearMe, regionCounts, sampleTiles, SAMPLING_ZOOM, thailandTiles, type FloodSample, type FloodTile } from "@/lib/flood/viirs";
import { floodDate, gibsTileUrl } from "@/lib/map/gibs";
import { WeatherCache } from "@/lib/weather/cache";

const SIX_HOURS = 6 * 60 * 60 * 1000;
const cache = new WeatherCache<Snapshot>(() => Date.now(), 2, SIX_HOURS);
let masks: Promise<ProvinceMask[]> | null = null;
const refreshing = new Map<string, Promise<Snapshot | null>>();
const headers = { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" };
type Snapshot = {
  samples: FloodSample[];
  payload: { date: string; fetchedAt: string; attribution: string[]; sampling: { zoom: number; tileSize: number; unit: string };
    provinceCounts: ReturnType<typeof countsByProvince>; regionCounts: ReturnType<typeof regionCounts> };
};

function readMask(): Promise<ProvinceMask[]> {
  masks ??= readFile(join(process.cwd(), "public/data/th-provinces-adm1.geojson"), "utf8")
    .then((text) => prepareProvinceMask(JSON.parse(text) as ProvinceGeoJson))
    .catch((error) => { masks = null; throw error; });
  return masks;
}

function refresh(date: string): Promise<Snapshot | null> {
  const pending = refreshing.get(date);
  if (pending) return pending;
  const promise = (async () => {
    try {
      const mask = await readMask();
      const coordinates = thailandTiles();
      const previousDate = floodDate(Date.parse(`${date}T00:00:00Z`));
      for (const observationDate of [date, previousDate]) {
        const tiles: FloodTile[] = [];
        let index = 0;
        const controller = new AbortController();
        // Bound concurrent downloads; a missing tile must never turn into a zero-flood result.
        const downloads = await Promise.allSettled(Array.from({ length: 6 }, async () => {
          try {
            while (index < coordinates.length && !controller.signal.aborted) {
              const coordinate = coordinates[index++];
              const response = await fetch(gibsTileUrl("VIIRS_Combined_Flood_2-Day", observationDate, coordinate), {
                next: { revalidate: 21600 }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
              });
              if (!response.ok) throw new Error(`GIBS tile: ${response.status}`);
              const image = decodePalettePng(new Uint8Array(await response.arrayBuffer()));
              if (image.width !== 256 || image.height !== 256) throw new Error("Unexpected GIBS tile dimensions");
              tiles.push({ ...coordinate, image });
            }
          } catch (error) {
            controller.abort();
            throw error;
          }
        }));
        if (downloads.some((result) => result.status === "rejected")) continue;
        const samples = sampleTiles(tiles, mask);
        const provinces = countsByProvince(samples, mask);
        const snapshot: Snapshot = { samples, payload: {
          date: observationDate, fetchedAt: new Date().toISOString(), attribution: FLOOD_ATTRIBUTION,
          sampling: { zoom: SAMPLING_ZOOM, tileSize: 256, unit: "grid-pixel-centres" },
          provinceCounts: provinces, regionCounts: regionCounts(provinces),
        } };
        cache.set(date, snapshot);
        return snapshot;
      }
      return null;
    } catch { return null; }
  })().finally(() => { refreshing.delete(date); });
  refreshing.set(date, promise);
  return promise;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const hasPlace = params.has("lat") || params.has("lon");
  const place = hasPlace ? parseLatLon(params.get("lat"), params.get("lon")) : null;
  if (hasPlace && !place) return Response.json({ error: "bad_coordinates" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const date = floodDate(Date.now());
  const fresh = cache.getFresh(date);
  const stale = fresh ? undefined : cache.getStale(date);
  if (stale) after(() => refresh(date));
  const snapshot = fresh ?? stale ?? await refresh(date);
  if (!snapshot) return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json({ ...snapshot.payload, stale: !!stale,
    ...(place ? { nearMe: nearMe(snapshot.samples, place) } : {}),
  }, { headers: stale ? { "Cache-Control": "public, s-maxage=300" } : headers });
}

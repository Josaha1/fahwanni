import { cacheKey, parseLatLon, roundCoord } from "@/lib/geo";
import { WeatherCache } from "@/lib/weather/cache";
import { fetchWeather, WeatherError } from "@/lib/weather/client";

const cache = new WeatherCache();
const successHeaders = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" };
const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const location = parseLatLon(params.get("lat"), params.get("lon"));
  const lang = params.get("lang") ?? "th";
  if (!location || (lang !== "th" && lang !== "en")) {
    return Response.json({ error: "bad_request" }, { status: 400, headers: noStoreHeaders });
  }

  const lat = roundCoord(location.lat);
  const lon = roundCoord(location.lon);
  const key = cacheKey(lat, lon, lang);
  const fresh = cache.getFresh(key);
  if (fresh) return Response.json(fresh, { headers: successHeaders });

  try {
    const snapshot = await fetchWeather(lat, lon, lang);
    cache.set(key, snapshot);
    return Response.json(snapshot, { headers: successHeaders });
  } catch (error) {
    if (error instanceof WeatherError && error.code !== "no_key") {
      const stale = cache.getStale(key);
      if (stale) {
        return Response.json(stale, {
          headers: { ...noStoreHeaders, "X-Weather-Stale": "1" },
        });
      }
    }

    const code = error instanceof WeatherError ? error.code : "upstream";
    return Response.json({ error: code }, { status: code === "no_key" ? 503 : 502, headers: noStoreHeaders });
  }
}

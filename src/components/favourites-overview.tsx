"use client";

import { useEffect, useState } from "react";
import { useFavourites } from "@/hooks/use-favourites";
import { useT } from "@/i18n/client";
import { describeCondition, iconUrl } from "@/lib/condition";
import { cacheKey, roundCoord } from "@/lib/geo";
import type { Place } from "@/lib/place";
import { isFresh, parseWeatherCache, serializeWeatherCache, type WeatherCacheEntry } from "@/lib/weather-cache-client";
import type { WeatherSnapshot } from "@/lib/weather/types";

const MAX_CITIES = 5;
/** One /api/weather call = 4 Google SKUs; the key is capped at 10 calls per SKU per minute. */
const GAP_MS = 6_000;

const storageKey = (place: Place, lang: "th" | "en") => `fah-snapshot:${cacheKey(place.lat, place.lon, lang)}`;

function readCache(place: Place, lang: "th" | "en"): WeatherCacheEntry | undefined {
  try { return parseWeatherCache(localStorage.getItem(storageKey(place, lang))); } catch { return undefined; }
}

/** At-a-glance grid of favourite places; tapping one opens its full forecast. */
export function FavouritesOverview({ current, onSelect, isDark }: { current: Place; onSelect: (place: Place) => void; isDark: boolean }) {
  const t = useT();
  const { favourites } = useFavourites();
  const places = favourites.slice(0, MAX_CITIES);
  const [snapshots, setSnapshots] = useState<Record<string, WeatherSnapshot>>({});
  const ids = places.map((place) => place.id).join("|");

  useEffect(() => {
    if (places.length < 2) return;
    let cancelled = false;
    const timers: number[] = [];
    const initial: Record<string, WeatherSnapshot> = {};
    const stale: Place[] = [];
    for (const place of places) {
      const cached = readCache(place, t.locale);
      if (cached) initial[place.id] = cached.snapshot;
      const isCurrent = roundCoord(place.lat) === roundCoord(current.lat) && roundCoord(place.lon) === roundCoord(current.lon);
      if (!isCurrent && (!cached || !isFresh(cached.savedAt, Date.now()))) stale.push(place);
    }
    timers.push(window.setTimeout(() => { if (!cancelled) setSnapshots(initial); }, 0));
    stale.forEach((place, index) => {
      timers.push(window.setTimeout(async () => {
        if (cancelled) return;
        try {
          const query = new URLSearchParams({ lat: String(place.lat), lon: String(place.lon), lang: t.locale });
          const response = await fetch(`/api/weather?${query}`);
          if (!response.ok || cancelled) return;
          const snapshot = await response.json() as WeatherSnapshot;
          try { localStorage.setItem(storageKey(place, t.locale), serializeWeatherCache({ snapshot, air: readCache(place, t.locale)?.air, savedAt: Date.now() })); } catch { /* optional */ }
          setSnapshots((all) => ({ ...all, [place.id]: snapshot }));
        } catch { /* keep the cached value */ }
      }, 500 + index * GAP_MS));
    });
    return () => { cancelled = true; timers.forEach((timer) => window.clearTimeout(timer)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the set of places or language changes
  }, [ids, t.locale]);

  if (places.length < 2) return null;
  return (
    <section className="placeholder-card" aria-label={t("เมืองโปรดของคุณ")}>
      <h2 className="text-xl">{t("เมืองโปรดของคุณ")}</h2>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {places.map((place) => {
          const snapshot = snapshots[place.id];
          const today = snapshot?.days[0];
          const name = place.source === "gps" ? t("ตำแหน่งปัจจุบัน") : place.name;
          return (
            <li key={place.id}>
              <button type="button" onClick={() => onSelect(place)}
                className="flex min-h-20 w-full items-center gap-2 rounded-2xl border border-border bg-background p-3 text-left focus-visible:outline-2 focus-visible:outline-given">
                {snapshot?.iconBaseUri
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={iconUrl(snapshot.iconBaseUri, isDark)} alt="" width={36} height={36} className="size-9 shrink-0" />
                  : <span className="size-9 shrink-0" aria-hidden="true" />}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{name}</span>
                  {snapshot ? <>
                    <span className="block text-lg font-semibold leading-tight">{snapshot.tempC === undefined ? "—" : `${Math.round(snapshot.tempC)}°`}</span>
                    <span className="block truncate text-xs text-muted">
                      {describeCondition(snapshot.conditionType)[t.locale]}
                      {today?.maxTempC !== undefined && today.minTempC !== undefined && ` · ${Math.round(today.minTempC)}–${Math.round(today.maxTempC)}°`}
                    </span>
                  </> : <span className="block text-xs text-muted">{t("กำลังโหลด…")}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useFavourites } from "@/hooks/use-favourites";
import { useT } from "@/i18n/client";
import { comparisonValues } from "@/lib/favourites-comparison";
import { cacheKey, roundCoord } from "@/lib/geo";
import type { Place } from "@/lib/place";
import { nearestRiverWithStatus, type NearbyRiver } from "@/lib/rivers/near";
import { statusWord } from "@/lib/rivers/status";
import { isFresh, parseWeatherCache, serializeWeatherCache, type WeatherCacheEntry } from "@/lib/weather-cache-client";
import type { WeatherSnapshot } from "@/lib/weather/types";

const MAX_CITIES = 5;
/** One /api/weather call = 4 Google SKUs; the key is capped at 10 calls per SKU per minute. */
const GAP_MS = 6_000;

const storageKey = (place: Place, lang: "th" | "en") => `fah-snapshot:${cacheKey(place.lat, place.lon, lang)}`;

function readCache(place: Place, lang: "th" | "en"): WeatherCacheEntry | undefined {
  try { return parseWeatherCache(localStorage.getItem(storageKey(place, lang))); } catch { return undefined; }
}

/** At-a-glance comparison of favourite places; tapping one opens its full forecast. */
export function FavouritesOverview({ current, onSelect }: { current: Place; onSelect: (place: Place) => void; isDark: boolean }) {
  const t = useT();
  const { favourites } = useFavourites();
  const places = favourites.slice(0, MAX_CITIES);
  const [entries, setEntries] = useState<Record<string, WeatherCacheEntry>>({});
  const [rivers, setRivers] = useState<NearbyRiver[]>([]);
  const ids = places.map((place) => place.id).join("|");
  const show = places.length >= 2;

  useEffect(() => {
    if (!show) return;
    const controller = new AbortController();
    fetch("/api/rivers", { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error(`Rivers returned ${response.status}`);
      return response.json() as Promise<{ points?: NearbyRiver[] }>;
    }).then((data) => {
      if (!controller.signal.aborted && Array.isArray(data.points)) setRivers(data.points);
    }).catch(() => { /* water status remains unavailable */ });
    return () => controller.abort();
  }, [show]);

  useEffect(() => {
    if (places.length < 2) return;
    let cancelled = false;
    const timers: number[] = [];
    const initial: Record<string, WeatherCacheEntry> = {};
    const stale: Place[] = [];
    for (const place of places) {
      const cached = readCache(place, t.locale);
      if (cached) initial[place.id] = cached;
      const isCurrent = roundCoord(place.lat) === roundCoord(current.lat) && roundCoord(place.lon) === roundCoord(current.lon);
      if (!isCurrent && (!cached || !isFresh(cached.savedAt, Date.now()))) stale.push(place);
    }
    timers.push(window.setTimeout(() => { if (!cancelled) setEntries(initial); }, 0));
    stale.forEach((place, index) => {
      timers.push(window.setTimeout(async () => {
        if (cancelled) return;
        try {
          const query = new URLSearchParams({ lat: String(place.lat), lon: String(place.lon), lang: t.locale });
          const response = await fetch(`/api/weather?${query}`);
          if (!response.ok || cancelled) return;
          const snapshot = await response.json() as WeatherSnapshot;
          const entry = { snapshot, air: readCache(place, t.locale)?.air, savedAt: Date.now() };
          try { localStorage.setItem(storageKey(place, t.locale), serializeWeatherCache(entry)); } catch { /* optional */ }
          setEntries((all) => ({ ...all, [place.id]: entry }));
        } catch { /* keep the cached value */ }
      }, 500 + index * GAP_MS));
    });
    return () => { cancelled = true; timers.forEach((timer) => window.clearTimeout(timer)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the set of places or language changes
  }, [ids, t.locale]);

  if (!show) return null;
  return (
    <section className="placeholder-card" aria-label={t("เมืองโปรดของคุณ")}>
      <h2 className="text-xl">{t("เมืองโปรดของคุณ")}</h2>
      <table className="mt-3 w-full table-fixed text-left text-xs sm:text-sm">
        <thead className="text-muted">
          <tr className="border-b border-border">
            <th scope="col" className="w-[32%] whitespace-nowrap pb-2 pr-1 font-medium">{t("สถานที่")}</th>
            <th scope="col" className="w-[17%] whitespace-nowrap pb-2 pr-2 font-medium">{t("อุณหภูมิ")}</th>
            <th scope="col" className="w-[11%] whitespace-nowrap pb-2 pr-2 font-medium">{t("ฝน")}</th>
            <th scope="col" className="w-[14%] whitespace-nowrap pb-2 pr-2 font-medium">PM2.5</th>
            <th scope="col" className="w-[26%] whitespace-nowrap pb-2 font-medium">{t("น้ำใกล้")}</th>
          </tr>
        </thead>
        <tbody>
          {places.map((place) => {
            const entry = entries[place.id];
            const values = comparisonValues(entry?.snapshot, entry?.air);
            const nearest = nearestRiverWithStatus(place, rivers);
            const name = place.source === "gps" ? t("ตำแหน่งปัจจุบัน") : place.name;
            const selected = roundCoord(place.lat) === roundCoord(current.lat) && roundCoord(place.lon) === roundCoord(current.lon);
            return <tr key={place.id} className={`relative border-b border-border last:border-0 hover:bg-sky focus-within:bg-sky ${selected ? "bg-sky" : ""}`}>
              <th scope="row" className="min-w-0 pr-1 font-semibold">
                <button type="button" onClick={() => onSelect(place)} aria-current={selected ? "true" : undefined}
                  className="min-h-11 w-full break-words py-2 text-left after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given">
                  {name}
                </button>
              </th>
              <td className="pr-2">{values.tempC === null ? "—" : `${values.tempC}°`}</td>
              <td className="pr-2">{values.rainChance === null ? "—" : `${values.rainChance}%`}</td>
              <td className="pr-2">{values.pm25 ?? "—"}</td>
              <td className="break-words">{nearest?.summary ? t(statusWord(nearest.summary.today.status)) : "—"}</td>
            </tr>;
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">{t("สถานะน้ำใกล้จากแบบจำลอง")}</p>
    </section>
  );
}

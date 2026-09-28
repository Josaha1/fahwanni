"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { AirSnapshot } from "@/lib/air";
import { cacheKey } from "@/lib/geo";
import type { Place } from "@/lib/place";
import type { WeatherSnapshot } from "@/lib/weather/types";
import { isFresh, parseWeatherCache, serializeWeatherCache, updatedAgo, weatherErrorCode, type WeatherCacheEntry, type WeatherErrorCode } from "@/lib/weather-cache-client";

type WeatherStatus = "idle" | "loading" | "ready" | "error";
type WeatherState = { key: string; entry?: WeatherCacheEntry; status: WeatherStatus; error?: WeatherErrorCode; stale: boolean };

function readCacheRaw(key: string): string | null {
  try { return localStorage.getItem(`fah-snapshot:${key}`); }
  catch { return null; }
}

function readCache(key: string): WeatherCacheEntry | undefined {
  return parseWeatherCache(readCacheRaw(key));
}

function writeCache(key: string, entry: WeatherCacheEntry) {
  try { localStorage.setItem(`fah-snapshot:${key}`, serializeWeatherCache(entry)); }
  catch { /* Weather remains usable when storage is unavailable. */ }
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    throw weatherErrorCode(body);
  }
  return response.json() as Promise<T>;
}

export function useWeather(place: Place | null, lang: "th" | "en") {
  const key = place ? cacheKey(place.lat, place.lon, lang) : "";
  const subscribe = useCallback((onChange: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === `fah-snapshot:${key}` || event.key === null) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);
  const getSnapshot = useCallback(() => key ? readCacheRaw(key) : null, [key]);
  const rawCache = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const cached = useMemo(() => parseWeatherCache(rawCache), [rawCache]);
  const [state, setState] = useState<WeatherState>(() => ({
    key, entry: cached, status: key ? cached ? "ready" : "loading" : "idle",
    stale: Boolean(cached && !isFresh(cached.savedAt, Date.now())),
  }));
  const [refreshCount, setRefreshCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const savedAt = useRef<number | undefined>(cached?.savedAt);
  const lastRefresh = useRef(0);
  const lat = place?.lat;
  const lon = place?.lon;
  const active = state.key === key ? {
    ...state,
    entry: state.entry ?? cached,
    status: state.entry ? state.status : cached && state.status === "loading" ? "ready" : state.status,
  } : {
    key, entry: cached, status: key ? cached ? "ready" : "loading" : "idle" as WeatherStatus,
    stale: Boolean(cached && !isFresh(cached.savedAt, now)),
  };

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    const controller = new AbortController();
    const initial = readCache(key);
    savedAt.current = initial?.savedAt;
    const forced = refreshCount !== lastRefresh.current;
    lastRefresh.current = refreshCount;
    let inFlight = false;

    async function fetchLatest(force = false) {
      if (inFlight) return;
      const age = savedAt.current;
      if (age !== undefined && isFresh(age, Date.now()) && !force) return;
      inFlight = true;
      setState((previous) => ({
        key, entry: previous.key === key ? previous.entry : initial,
        status: "loading", stale: Boolean(age && !isFresh(age, Date.now())),
      }));
      const query = new URLSearchParams({ lat: String(lat), lon: String(lon), lang });
      try {
        const [weather, air] = await Promise.allSettled([
          fetch(`/api/weather?${query}`, { signal: controller.signal }),
          fetch(`/api/air?${query}`, { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        if (weather.status === "rejected") throw navigator.onLine ? "upstream" : "offline";
        const snapshot = await readResponse<WeatherSnapshot>(weather.value);
        let airSnapshot: AirSnapshot | undefined;
        if (air.status === "fulfilled" && air.value.ok) {
          try { airSnapshot = await readResponse<AirSnapshot>(air.value); }
          catch { /* Air data is optional. */ }
        }
        if (controller.signal.aborted) return;
        const entry = { snapshot, air: airSnapshot ?? readCache(key)?.air ?? initial?.air, savedAt: Date.now() };
        savedAt.current = entry.savedAt;
        writeCache(key, entry);
        setState({ key, entry, status: "ready", stale: weather.value.headers.has("X-Weather-Stale") });
        setNow(Date.now());
      } catch (error) {
        if (controller.signal.aborted) return;
        const code: WeatherErrorCode = typeof error === "string" ? weatherErrorCode({ error }) : navigator.onLine ? "upstream" : "offline";
        setState((previous) => {
          const entry = previous.key === key ? previous.entry : initial;
          return { key, entry, status: "error", error: code, stale: Boolean(entry) };
        });
      } finally {
        inFlight = false;
      }
    }

    const onResume = () => {
      if (savedAt.current === undefined || !isFresh(savedAt.current, Date.now())) void fetchLatest();
      setNow(Date.now());
    };
    void fetchLatest(forced);
    window.addEventListener("focus", onResume);
    window.addEventListener("online", onResume);
    return () => {
      controller.abort();
      window.removeEventListener("focus", onResume);
      window.removeEventListener("online", onResume);
    };
  }, [key, lat, lon, lang, refreshCount]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = useCallback(() => setRefreshCount((count) => count + 1), []);
  return {
    snapshot: active.entry?.snapshot,
    air: active.entry?.air,
    status: active.status,
    error: active.error,
    stale: active.stale || Boolean(active.entry && !isFresh(active.entry.savedAt, now)),
    updatedAt: active.entry ? new Date(active.entry.savedAt).toISOString() : undefined,
    updatedAgo: active.entry ? updatedAgo(active.entry.savedAt, now, lang) : undefined,
    refresh,
  };
}

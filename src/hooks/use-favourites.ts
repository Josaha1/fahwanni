"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { addFavourite, loadFavourites, moveFavourite, removeFavourite } from "@/lib/favourites";
import { readWatch, toggleWatch, writeWatch, type WatchItem, type WaterWatch } from "@/lib/water/watchlist";
import { roundCoord } from "@/lib/geo";
import type { Place } from "@/lib/place";
import { provinces } from "@/lib/provinces";

const LAST_PLACE_KEY = "fah-last-place";
const FAVOURITES_KEY = "fah-favourites";
const bangkok = provinces[0];
const defaultPlace: Place = {
  id: bangkok.id, name: bangkok.th, admin: bangkok.en, country: "Thailand",
  lat: bangkok.lat, lon: bangkok.lon, source: "province",
};

function validPlace(value: unknown): value is Place {
  if (!value || typeof value !== "object") return false;
  const place = value as Partial<Place>;
  return typeof place.id === "string" && typeof place.name === "string" &&
    typeof place.lat === "number" && Number.isFinite(place.lat) &&
    typeof place.lon === "number" && Number.isFinite(place.lon) &&
    (place.source === "province" || place.source === "search" || place.source === "gps");
}

function readRaw(key: string): string | null {
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function readLastPlace(raw: string | null): Place {
  try {
    if (raw) {
      const place: unknown = JSON.parse(raw);
      if (validPlace(place)) return place;
    }
  } catch { /* Use Bangkok when storage is unavailable or corrupt. */ }
  return defaultPlace;
}

function useStoredValue(key: string) {
  const subscribe = useCallback((onChange: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) onChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(`${key}-change`, onChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(`${key}-change`, onChange);
    };
  }, [key]);
  const getSnapshot = useCallback(() => readRaw(key), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function useFavourites() {
  const raw = useStoredValue(FAVOURITES_KEY);
  const favourites = useMemo(() => loadFavourites({ getItem: () => raw, setItem: () => {} }), [raw]);

  function update(operation: () => Place[]) {
    try {
      operation();
      window.dispatchEvent(new Event(`${FAVOURITES_KEY}-change`));
    } catch { /* Keep the existing list when storage is unavailable. */ }
  }

  return {
    favourites,
    add: (place: Place) => update(() => addFavourite(localStorage, place)),
    remove: (id: string) => update(() => removeFavourite(localStorage, id)),
    move: (id: string, dir: -1 | 1) => update(() => moveFavourite(localStorage, id, dir)),
    has: (place: Place) => favourites.some((item) =>
      roundCoord(item.lat) === roundCoord(place.lat) && roundCoord(item.lon) === roundCoord(place.lon)
    ),
  };
}

export function useLastPlace() {
  const raw = useStoredValue(LAST_PLACE_KEY);
  const place = useMemo(() => readLastPlace(raw), [raw]);

  function selectPlace(next: Place) {
    try {
      localStorage.setItem(LAST_PLACE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(`${LAST_PLACE_KEY}-change`));
    } catch { /* Keep the stored selection when storage is unavailable. */ }
  }

  return { place, setPlace: selectPlace };
}

export function useWaterWatch() {
  const raw = useStoredValue("fah-water-watch");
  const watch = useMemo(() => readWatch(raw), [raw]);
  const update = useCallback((operation: (current: WaterWatch) => WaterWatch) => {
    writeWatch(operation(readWatch()));
  }, []);
  return { watch, update, toggle: (item: WatchItem) => update((current) => toggleWatch(current, item)) };
}

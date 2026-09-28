import { roundCoord } from "./geo";
import type { Place } from "./place";

const KEY = "fah-favourites";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadFavourites(storage: StorageLike): Place[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((place): place is Place =>
      place !== null && typeof place === "object" &&
      typeof place.id === "string" && typeof place.name === "string" &&
      typeof place.lat === "number" && Number.isFinite(place.lat) &&
      typeof place.lon === "number" && Number.isFinite(place.lon) &&
      (place.source === "province" || place.source === "search" || place.source === "gps")
    ).slice(-8);
  } catch {
    return [];
  }
}

function save(storage: StorageLike, places: Place[]): Place[] {
  storage.setItem(KEY, JSON.stringify(places));
  return places;
}

export function addFavourite(storage: StorageLike, place: Place): Place[] {
  const places = loadFavourites(storage).filter((item) =>
    roundCoord(item.lat) !== roundCoord(place.lat) || roundCoord(item.lon) !== roundCoord(place.lon)
  );
  return save(storage, [...places, place].slice(-8));
}

export function removeFavourite(storage: StorageLike, id: string): Place[] {
  return save(storage, loadFavourites(storage).filter((place) => place.id !== id));
}

export function moveFavourite(storage: StorageLike, id: string, dir: -1 | 1): Place[] {
  const places = loadFavourites(storage);
  const index = places.findIndex((place) => place.id === id);
  const next = index + dir;
  if (index < 0 || next < 0 || next >= places.length) return places;
  [places[index], places[next]] = [places[next], places[index]];
  return save(storage, places);
}

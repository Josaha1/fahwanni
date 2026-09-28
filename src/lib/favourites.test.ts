import { describe, expect, it } from "vitest";
import { addFavourite, loadFavourites, moveFavourite, removeFavourite } from "./favourites";
import type { Place } from "./place";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

const place = (id: string, lat: number): Place => ({ id, name: id, lat, lon: 100.5, source: "search" });

describe("favourites", () => {
  it("handles corrupt JSON and persists with the expected key", () => {
    const storage = memoryStorage();
    storage.setItem("fah-favourites", "{");
    expect(loadFavourites(storage)).toEqual([]);
    addFavourite(storage, place("a", 13));
    expect(JSON.parse(storage.getItem("fah-favourites") ?? "")).toHaveLength(1);
  });

  it("deduplicates rounded coordinates, moving the newest match to the end", () => {
    const storage = memoryStorage();
    addFavourite(storage, place("a", 13.751));
    addFavourite(storage, place("b", 14));
    expect(addFavourite(storage, place("new", 13.754)).map((p) => p.id)).toEqual(["b", "new"]);
  });

  it("keeps at most eight and supports removal and reordering", () => {
    const storage = memoryStorage();
    for (let i = 0; i < 9; i++) addFavourite(storage, place(String(i), i));
    expect(loadFavourites(storage).map((p) => p.id)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
    expect(moveFavourite(storage, "2", -1).map((p) => p.id).slice(0, 2)).toEqual(["2", "1"]);
    expect(removeFavourite(storage, "2").map((p) => p.id)).not.toContain("2");
  });
});

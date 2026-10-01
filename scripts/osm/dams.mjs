// Pure helpers for scripts/osm/build-dams.mjs (OpenStreetMap waterway=dam in Thailand, ODbL).

const R = 6371;
export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const clean = (value) => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

/** One point per OSM element: node position or the way/relation centre Overpass returns with `out center`. */
export function damsFromOverpass(json) {
  return (json?.elements ?? []).flatMap((element) => {
    const lat = element.center?.lat ?? element.lat, lon = element.center?.lon ?? element.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const tags = element.tags ?? {};
    const nameTh = clean(tags["name:th"]) || clean(tags.name);
    const nameEn = clean(tags["name:en"]) || (/[฀-๿]/.test(clean(tags.name)) ? "" : clean(tags.name));
    return [{ id: `${element.type}/${element.id}`, nameTh, nameEn, lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 }];
  });
}

/**
 * Drops OSM dams already shown with water data: a named dam whose name contains an RID/DWR name within 3 km,
 * or an unnamed one within 1 km of any RID/DWR point (it is that dam's embankment).
 */
export function withoutKnown(dams, known) {
  return dams.filter((dam) => !known.some((place) => {
    const km = distanceKm(dam, place);
    if (!dam.nameTh) return km < 1;
    return km < 3 && Boolean(place.nameTh) && (dam.nameTh.includes(place.nameTh) || place.nameTh.includes(dam.nameTh.replace(/^เขื่อน/, "")));
  }));
}

/** RID's 35 dams from src/lib/dams/registry.ts (a TS file the .mjs build cannot import). */
export function registryPoints(source) {
  return [...source.matchAll(/nameTh: "([^"]+)"[^}]*?lat: ([\d.]+), lon: ([\d.]+)/g)]
    .map(([, nameTh, lat, lon]) => ({ nameTh, lat: Number(lat), lon: Number(lon) }));
}

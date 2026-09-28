import { roundCoord } from "../geo";
import type { Place } from "../place";
import { provinces } from "../provinces";
import { distanceKm } from "../storms/normalize";

export function nearestProvince(lat: number, lon: number): { id: string; th: string; en: string; lat: number; lon: number; km: number } {
  const nearest = provinces.reduce<{ id: string; th: string; en: string; lat: number; lon: number; km: number }>((best, province) => {
    const km = distanceKm({ lat, lon }, province);
    return km < best.km ? { ...province, km } : best;
  }, { ...provinces[0], km: Infinity });
  return nearest;
}

export function pointPlace(lat: number, lon: number): Place {
  const p = nearestProvince(lat, lon);
  const roundedLat = roundCoord(lat), roundedLon = roundCoord(lon);
  const coordinates = `${roundedLat.toFixed(2)}, ${roundedLon.toFixed(2)}`;
  return {
    id: `point-${roundedLat}-${roundedLon}`,
    name: p.km < 15 ? p.th : p.km <= 50 ? `ใกล้${p.th}` : coordinates,
    admin: p.km < 15 ? p.en : p.km <= 50 ? `Near ${p.en}` : coordinates,
    ...(p.km <= 50 ? { country: "Thailand" } : {}),
    lat: roundedLat, lon: roundedLon, source: "search",
  };
}

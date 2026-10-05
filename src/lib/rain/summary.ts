import { provinces } from "@/lib/provinces";
import { regionByProvince, type FloodRegion } from "@/lib/flood/viirs";
import { distanceKm, type Position } from "@/lib/storms/normalize";
import type { ReportingRainStation } from "@/lib/rain-risk/tmd";
import type { ForecastDay } from "@/lib/wind/days";
import { sampleAt } from "@/lib/wind/grid";

export const rainRegions: Record<FloodRegion, string> = { north: "ภาคเหนือ", northeast: "ภาคตะวันออกเฉียงเหนือ", central: "ภาคกลาง", east: "ภาคตะวันออก", west: "ภาคตะวันตก", south: "ภาคใต้" };
export const periods = [1, 3, 7] as const;
export type RainTotals = [number | null, number | null, number | null];

export function stationRegion(station: ReportingRainStation): FloodRegion | null {
  const province = provinces.find((entry) => entry.th === station.provinceTh.replace(/^จังหวัด/, "").trim());
  return province ? regionByProvince.get(province.id) ?? "central" : null;
}

export function observedSummary(stations: ReportingRainStation[], place: Position) {
  const regions = Object.keys(rainRegions).flatMap((region) => {
    const rows = stations.filter((station) => stationRegion(station) === region);
    return rows.length ? [{ region: region as FloodRegion, mm: rows.reduce((sum, row) => sum + row.rainMm, 0) / rows.length }] : [];
  }).sort((a, b) => b.mm - a.mm);
  return {
    top: [...stations].sort((a, b) => b.rainMm - a.rainMm)[0] ?? null,
    near: [...stations].sort((a, b) => distanceKm(place, a) - distanceKm(place, b))[0] ?? null,
    over35: stations.filter((station) => station.rainMm > 35).length,
    over90: stations.filter((station) => station.rainMm > 90).length,
    regions,
  };
}

/** Calendar-day totals from the existing seven-day grid; incomplete days stay missing. */
export function placeTotals(days: ForecastDay[], place: Position): { date: string | null; totals: RainTotals } {
  const first = days.find((day) => day.day === 0);
  const totals = periods.map((period) => {
    let sum = 0;
    for (let index = 0; index < period; index++) {
      const day = days.find((entry) => entry.day === index);
      if (!day || !first || day.date !== new Date(Date.parse(`${first.date}T00:00:00Z`) + index * 86400000).toISOString().slice(0, 10) || day.hours.length !== 24 || day.precip.length !== 24 || day.hours.some((hour, at) => Date.parse(hour) !== Date.parse(`${day.date}T00:00:00+07:00`) + at * 3600000)) return null;
      for (const row of day.precip) {
        const mm = sampleAt({ ...day, u: [row], v: [row] }, 0, place.lon, place.lat)?.u;
        if (mm === undefined || !Number.isFinite(mm) || mm < 0) return null;
        sum += mm;
      }
    }
    return Math.round(sum * 10) / 10;
  }) as RainTotals;
  return { date: first?.date ?? null, totals };
}

export function nextFrame(index: number, count: number): number { return count > 0 ? (index + 1) % count : 0; }

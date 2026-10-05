import { z } from "zod";
import { distanceKm } from "@/lib/storms/normalize";
import type { RegisteredDam } from "@/lib/dams/registry";
import { periods, type RainTotals } from "./summary";

export type DamRain = { id: string; date: string | null; samples: number; totals: RainTotals };

/** A 20 km lattice: all nine requested points lie within the 30 km circle. */
export function damGrid(dam: RegisteredDam) {
  return [-20, 0, 20].flatMap((north) => [-20, 0, 20].map((east) => ({
    lat: dam.lat + north / 111.2, lon: dam.lon + east / (111.2 * Math.cos(dam.lat * Math.PI / 180)),
  })));
}

const location = z.object({ latitude: z.number(), longitude: z.number(), daily: z.object({
  time: z.array(z.string().regex(/^\d{4}-\d\d-\d\d$/)), precipitation_sum: z.array(z.number().nonnegative().nullable()),
}) });

/** Average unique returned model cells, excluding cells snapped outside the circle. */
export function parseDamRain(raw: unknown, dams: RegisteredDam[]): DamRain[] | null {
  const parsed = z.array(location).length(dams.length * 9).safeParse(raw);
  if (!parsed.success) return null;
  return dams.map((dam, index) => {
    const cells = parsed.data.slice(index * 9, (index + 1) * 9).filter((cell, at, rows) =>
      distanceKm(dam, { lat: cell.latitude, lon: cell.longitude }) <= 30 &&
      rows.findIndex((row) => row.latitude === cell.latitude && row.longitude === cell.longitude) === at);
    const date = cells[0]?.daily.time[0] ?? null;
    const totals = periods.map((period) => {
      if (!cells.length || !date) return null;
      let sum = 0;
      for (const cell of cells) for (let day = 0; day < period; day++) {
        const expected = new Date(Date.parse(`${date}T00:00:00Z`) + day * 86400000).toISOString().slice(0, 10);
        const mm = cell.daily.precipitation_sum[day];
        if (cell.daily.time[day] !== expected || mm == null) return null;
        sum += mm;
      }
      return Math.round(sum / cells.length * 10) / 10;
    }) as RainTotals;
    return { id: dam.id, date, samples: cells.length, totals };
  });
}

import { z } from "zod";

export type RainStation = { id: string; nameTh: string; nameEn: string; provinceTh: string; lat: number; lon: number; rainMm: number; category: "heavy" | "veryHeavy" };
export type ReportingRainStation = Omit<RainStation, "category">;
export type RainRisk = { observedAt: string | null; reporting: number; stations: RainStation[]; all: ReportingRainStation[] };

const report = z.object({ Stations: z.object({ Station: z.array(z.unknown()) }) });
const station = z.object({
  WmoStationNumber: z.string().min(1), StationNameThai: z.string().min(1),
  StationNameEnglish: z.string(), Province: z.string().min(1),
  Latitude: z.string(), Longitude: z.string(),
  Observation: z.object({ DateTime: z.string(), Rainfall: z.string().optional() }),
});
const numeric = (value: string | undefined) => value !== undefined && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null;

export function rainCategory(mm: number): RainStation["category"] | null {
  return mm > 90 ? "veryHeavy" : mm > 35 ? "heavy" : null;
}

export function parseTmdRain(raw: unknown): RainRisk {
  const parsed = report.safeParse(raw);
  if (!parsed.success) return { observedAt: null, reporting: 0, stations: [], all: [] };
  let reporting = 0;
  let observedAt: string | null = null;
  const stations: RainStation[] = [];
  const all: ReportingRainStation[] = [];
  for (const row of parsed.data.Stations.Station) {
    const result = station.safeParse(row);
    if (!result.success) continue;
    const value = result.data;
    const rainMm = numeric(value.Observation.Rainfall);
    if (rainMm === null || rainMm < 0) continue;
    reporting++;
    const date = value.Observation.DateTime.replace(" ", "T").replace(/\.\d+$/, "") + "+07:00";
    if (observedAt === null && Number.isFinite(Date.parse(date))) observedAt = date;
    const lat = numeric(value.Latitude), lon = numeric(value.Longitude);
    if (lat === null || lon === null || lat < 5 || lat > 21 || lon < 97 || lon > 106) continue;
    const entry = { id: value.WmoStationNumber, nameTh: value.StationNameThai, nameEn: value.StationNameEnglish,
      provinceTh: value.Province, lat, lon, rainMm };
    all.push(entry);
    const category = rainCategory(rainMm);
    if (category) stations.push({ ...entry, category });
  }
  stations.sort((a, b) => b.rainMm - a.rainMm);
  return { observedAt, reporting, stations, all };
}

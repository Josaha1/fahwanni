import { z } from "zod";
export { rainTotalMm, soilWord, sprayWindow, type SoilWord } from "./agri-helpers";

export interface AgriSnapshot {
  available: boolean;
  et0TodayMm?: number;
  et0TomorrowMm?: number;
  /** Volumetric water content, m³/m³. */
  soilTop?: number;
  soilRoot?: number;
  attribution: { text: string; url: string };
}

const attribution = { text: "Soil & evaporation: Open-Meteo.com (CC BY 4.0)", url: "https://open-meteo.com" };

const schema = z.object({
  daily: z.object({ et0_fao_evapotranspiration: z.array(z.number().nullable()) }),
  hourly: z.object({
    soil_moisture_0_to_1cm: z.array(z.number().nullable()),
    soil_moisture_3_to_9cm: z.array(z.number().nullable()),
  }),
});

const first = (values: (number | null)[]) => values.find((v): v is number => v !== null);
const round = (n: number | undefined, digits: number) => n === undefined ? undefined : Math.round(n * 10 ** digits) / 10 ** digits;

export function toAgri(raw: unknown): AgriSnapshot {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { available: false, attribution };
  const { daily, hourly } = parsed.data;
  const [today, tomorrow] = daily.et0_fao_evapotranspiration;
  const soilTop = first(hourly.soil_moisture_0_to_1cm);
  const soilRoot = first(hourly.soil_moisture_3_to_9cm);
  if (today === null && soilTop === undefined) return { available: false, attribution };
  return {
    available: true,
    et0TodayMm: round(today ?? undefined, 1),
    et0TomorrowMm: round(tomorrow ?? undefined, 1),
    soilTop: round(soilTop, 2),
    soilRoot: round(soilRoot, 2),
    attribution,
  };
}

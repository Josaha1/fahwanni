import { z } from "zod";

const airSchema = z.object({
  dateTime: z.string().optional(),
  indexes: z.array(z.object({
    code: z.string().optional(),
    aqi: z.number().optional(),
    category: z.string().optional(),
  })).optional(),
  pollutants: z.array(z.object({
    code: z.string().optional(),
    concentration: z.object({
      value: z.number().optional(),
      units: z.string().optional(),
    }).optional(),
  })).optional(),
});

export interface AirSnapshot {
  pm25?: number;
  pm10?: number;
  aqi?: number;
  aqiCategory?: string;
  localAqi?: { code: string; aqi: number; category?: string };
  dateTime?: string;
}

export function normalizeAir(raw: unknown): AirSnapshot {
  const air = airSchema.parse(raw);
  const concentration = (code: string) => air.pollutants?.find((pollutant) =>
    pollutant.code === code && pollutant.concentration?.units === "MICROGRAMS_PER_CUBIC_METER"
  )?.concentration?.value;
  const universal = air.indexes?.find((index) => index.code === "uaqi");
  const local = air.indexes?.find((index) => index.code && index.code !== "uaqi" && index.aqi !== undefined);

  return {
    pm25: concentration("pm25"),
    pm10: concentration("pm10"),
    aqi: universal?.aqi,
    aqiCategory: universal?.category,
    localAqi: local ? { code: local.code!, aqi: local.aqi!, category: local.category } : undefined,
    dateTime: air.dateTime,
  };
}

export type Pm25Level = "good" | "moderate" | "sensitive" | "unhealthy" | "very-unhealthy";

export function pm25Level(value: number): Pm25Level {
  if (value <= 15) return "good";
  if (value <= 25) return "moderate";
  if (value <= 37.5) return "sensitive";
  if (value <= 75) return "unhealthy";
  return "very-unhealthy";
}

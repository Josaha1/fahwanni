import { z } from "zod";
import { inStormBbox, type Position, type Storm } from "./normalize";

const pointSchema = z.tuple([z.number(), z.number()]);
const timeSchema = z.object({ UTC: z.string().optional(), JST: z.string().optional() });
const nameSchema = z.object({ en: z.string().optional(), jp: z.string().optional() });

export const targetTcSchema = z.array(z.object({
  tropicalCyclone: z.string().optional(),
  typhoonNumber: z.string().optional(),
  category: z.string().optional(),
  issue: z.string().optional(),
}));

export const forecastSchema = z.array(z.object({
  part: z.union([z.string(), nameSchema]).optional(),
  issue: timeSchema.optional(),
  name: nameSchema.optional(),
  advancedHours: z.number().optional(),
  validtime: timeSchema.optional(),
  center: pointSchema.optional(),
  track: z.object({
    preTyphoon: z.array(pointSchema).optional(),
    typhoon: z.array(pointSchema).optional(),
  }).optional(),
  probabilityCircle: z.object({ radius: z.number().optional() }).optional(),
}));

export const specificationsSchema = z.array(z.object({
  part: z.union([z.string(), nameSchema]).optional(),
  issue: timeSchema.optional(),
  name: nameSchema.optional(),
  category: z.union([z.string(), nameSchema]).optional(),
  advancedHours: z.number().optional(),
  validtime: timeSchema.optional(),
  position: z.object({ deg: pointSchema.optional() }).optional(),
  maximumWind: z.object({ sustained: z.object({ kt: z.string().optional() }).optional() }).optional(),
  pressure: z.string().optional(),
  probabilityCircleRadius: z.object({ km: z.number().optional() }).optional(),
}));

type Target = z.infer<typeof targetTcSchema>[number];

function position(point?: [number, number]): Position | undefined {
  if (!point) return undefined;
  const [lat, lon] = point;
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 ? { lat, lon } : undefined;
}

export function parseJmaStorm(target: Target, forecastInput: unknown, specificationsInput: unknown): Storm | undefined {
  const forecast = forecastSchema.parse(forecastInput);
  const specifications = specificationsSchema.parse(specificationsInput);
  const currentForecast = forecast.find((part) => part.advancedHours === 0);
  const currentSpecs = specifications.find((part) => part.advancedHours === 0);
  const current = position(currentSpecs?.position?.deg ?? currentForecast?.center);
  if (!target.tropicalCyclone || !current || !inStormBbox(current)) return undefined;

  const titleForecast = forecast.find((part) => part.part === "title");
  const titleSpecs = specifications.find((part) => part.part === "title");
  const name = titleSpecs?.name ?? titleForecast?.name;
  const en = name?.en?.trim();
  const jp = name?.jp?.trim();
  const category = currentSpecs?.category ?? titleSpecs?.category ?? target.category;
  const rawWind = Number(currentSpecs?.maximumWind?.sustained?.kt);
  const rawPressure = Number(currentSpecs?.pressure);
  const track = [...(currentForecast?.track?.preTyphoon ?? []), ...(currentForecast?.track?.typhoon ?? [])]
    .map((point) => position(point))
    .filter((point): point is Position => point !== undefined)
    .filter((point, index, points) => index === 0 || point.lat !== points[index - 1].lat || point.lon !== points[index - 1].lon);
  const future = forecast.filter((part) => (part.advancedHours ?? 0) > 0);
  const predictions = future.flatMap((part) => {
    const specs = specifications.find((item) => item.advancedHours === part.advancedHours);
    const point = position(part.center ?? specs?.position?.deg);
    const time = part.validtime?.UTC ?? part.validtime?.JST ?? specs?.validtime?.UTC ?? specs?.validtime?.JST;
    if (!point || !time) return [];
    const radius = part.probabilityCircle?.radius;
    return [{ ...point, time, ...(radius !== undefined ? { radiusKm: radius / 1000 } :
      specs?.probabilityCircleRadius?.km !== undefined ? { radiusKm: specs.probabilityCircleRadius.km } : {}) }];
  });

  return {
    id: target.tropicalCyclone,
    source: "jma",
    name: en && jp ? `${en} (${jp})` : en ?? jp ?? target.typhoonNumber ?? target.tropicalCyclone,
    ...(typeof category === "string" ? { category } : category?.en ? { category: category.en } : {}),
    position: current,
    ...(Number.isFinite(rawWind) && rawWind > 0 ? { windKmh: rawWind * 1.852 } : {}),
    ...(Number.isFinite(rawPressure) && rawPressure > 0 ? { pressureHpa: rawPressure } : {}),
    ...(target.issue ? { issuedAt: target.issue } : {}),
    track,
    forecast: predictions,
  };
}

import { z } from "zod";
import { inStormBbox, type Storm } from "./normalize";

export const gdacsSchema = z.object({
  features: z.array(z.object({
    geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]).optional() }).optional(),
    properties: z.object({
      eventid: z.union([z.number(), z.string()]).optional(),
      eventname: z.string().optional(),
      name: z.string().optional(),
      alertlevel: z.enum(["Green", "Orange", "Red"]).optional(),
      fromdate: z.string().optional(),
      todate: z.string().optional(),
      url: z.object({ report: z.string().optional() }).optional(),
    }).optional(),
  })).optional(),
});

export function parseGdacsStorms(input: unknown, now = new Date()): Storm[] {
  const data = gdacsSchema.parse(input);
  const cutoff = now.getTime() - 2 * 24 * 60 * 60 * 1000;
  return (data.features ?? []).flatMap((feature) => {
    const properties = feature.properties;
    const coordinates = feature.geometry?.coordinates;
    if (!properties?.eventid || !coordinates || !properties.todate) return [];
    const position = { lat: coordinates[1], lon: coordinates[0] };
    const end = Date.parse(properties.todate);
    if (!inStormBbox(position) || !Number.isFinite(end) || end < cutoff || end > now.getTime() + 2 * 24 * 60 * 60 * 1000) return [];
    return [{
      id: String(properties.eventid),
      source: "gdacs" as const,
      name: properties.name ?? properties.eventname ?? String(properties.eventid),
      ...(properties.alertlevel ? { alertLevel: properties.alertlevel } : {}),
      position,
      issuedAt: properties.todate,
      track: [],
      forecast: [],
      ...(properties.url?.report ? { url: properties.url.report } : {}),
    }];
  });
}

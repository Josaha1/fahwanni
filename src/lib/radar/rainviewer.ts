import { z } from "zod";
import type { RadarFrame, RadarManifest } from "./types";

const frameSchema = z.object({
  time: z.number().int().nonnegative(),
  path: z.string().startsWith("/"),
});

const rainviewerSchema = z.object({
  generated: z.number().int().nonnegative().optional(),
  host: z.url(),
  radar: z.object({ past: z.array(frameSchema) }),
  satellite: z.object({ infrared: z.array(frameSchema).optional() }).optional(),
});

const attribution = { text: "Weather data by RainViewer", url: "https://www.rainviewer.com" };

export function toManifest(raw: unknown): RadarManifest {
  const parsed = rainviewerSchema.safeParse(raw);
  if (!parsed.success) return { provider: "none", frames: [], satellite: [], maxZoom: 7, attribution };

  const { host, generated, radar, satellite } = parsed.data;
  const frames = (items: { time: number; path: string }[], suffix: string): RadarFrame[] => items.flatMap(({ time, path }) => {
    const date = new Date(time * 1000);
    return Number.isFinite(date.getTime()) ? [{ time: date.toISOString(), tileUrl: `${host}${path}/256/{z}/{x}/{y}/${suffix}` }] : [];
  });
  const generatedDate = generated === undefined ? undefined : new Date(generated * 1000);

  return {
    provider: "rainviewer",
    ...(generatedDate && Number.isFinite(generatedDate.getTime()) ? { generatedAt: generatedDate.toISOString() } : {}),
    frames: frames(radar.past, "2/1_1.png").sort((a, b) => a.time.localeCompare(b.time)).slice(-12),
    satellite: frames(satellite?.infrared ?? [], "0/0_0.png").sort((a, b) => a.time.localeCompare(b.time)),
    maxZoom: 7,
    attribution,
  };
}

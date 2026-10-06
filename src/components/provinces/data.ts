import { floodRegions, warningRegions } from "@/components/flood/home-data";
import type { FloodNowPayload } from "@/components/flood/home-data";
import type { FloodEventsPayload } from "@/components/water/flood-events";
import type { DamsPayload } from "@/lib/dams/client";
import { regionByProvince } from "@/lib/flood/viirs";
import type { TmdWarning, TmdWarnings } from "@/lib/tmd";
import type { RainRisk } from "@/lib/rain-risk/tmd";
import type { Bbox } from "@/lib/water/flood-risk";
import type { RainTotals } from "@/lib/rain/summary";
import { provinces } from "@/lib/provinces";

export type Province = (typeof provinces)[number];
export type PlaceRain = { date: string | null; totals: RainTotals; place: { lat: number; lon: number } };
export const validFlood = (value: FloodNowPayload) => typeof value?.date === "string" && !!value.provinceCounts;
export const validDams = (value: DamsPayload) => Array.isArray(value?.dams);
export const validWarnings = (value: TmdWarnings & { error?: string }) => Array.isArray(value?.items) && !value.error;
export const validEvents = (value: FloodEventsPayload) => Array.isArray(value?.items);
export const validRain = (value: RainRisk) => Array.isArray(value?.all);
export const validModel = (value: PlaceRain) => Array.isArray(value?.totals);

export function provinceWarnings(items: TmdWarning[], province: Province) {
  const region = regionByProvince.get(province.id) ?? "central";
  return items.filter((item) => {
    const text = `${item.title} ${item.description}`;
    return text.includes(province.th) || text.toLowerCase().includes(province.en.toLowerCase())
      || warningRegions(text).includes(region) || text.includes("ทั่วประเทศ")
      || (region === "south" && text.includes(floodRegions.south));
  });
}

/** Align to the proxy's quarter-degree grid, keeping every request within its span limit. */
export function riskBoxes([west, south, east, north]: Bbox): Bbox[] {
  const boxes: Bbox[] = [];
  for (let x = Math.floor(west * 4) / 4; x < east; x += 1.5) {
    for (let y = Math.floor(south * 4) / 4; y < north; y += 1.5) {
      boxes.push([x, y, Math.min(x + 1.5, Math.ceil(east * 4) / 4), Math.min(y + 1.5, Math.ceil(north * 4) / 4)]);
    }
  }
  return boxes;
}

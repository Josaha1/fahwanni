export const FOCUS: "flood" | "all" = "flood";

export type Feature =
  | "pm25" | "airport" | "marine" | "farm" | "longWeekend" | "sunMoon"
  | "quake" | "enso" | "favouritesTable" | "heatPrimary" | "tempPrimary"
  | "cloudPrimary" | "himawari" | "windOverlay" | "fireHotspots" | "imerg"
  | "bestTime" | "yesterday" | "seasonChip" | "aqiInShare";

const hidden: Record<Feature, boolean> = {
  pm25: true, airport: true, marine: true, farm: true, longWeekend: true,
  sunMoon: true, quake: true, enso: true, favouritesTable: true,
  heatPrimary: true, tempPrimary: true, cloudPrimary: true, himawari: true,
  windOverlay: true, fireHotspots: true, imerg: true, bestTime: true,
  yesterday: true, seasonChip: true, aqiInShare: true,
};

// Storms stay visible because they are relevant to rain and flooding.
export function isOn(feature: Feature, focus: "flood" | "all" = FOCUS): boolean {
  return focus === "all" || !hidden[feature];
}

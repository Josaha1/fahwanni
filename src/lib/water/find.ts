import type { Dam } from "../dams/types";
import type { WaterWatch } from "./watchlist";

export type DamFilter = "all" | "full" | "release" | "watched";
export type WaterHit = { kind: "dam" | "river"; id: string; name: string };

/** Dam markers kept by a water-mode filter chip; "full" means more than 80 % of capacity. */
export function filterDams(dams: Dam[], filter: DamFilter, watch: WaterWatch): Dam[] {
  switch (filter) {
    case "all": return dams;
    case "full": return dams.filter((dam) => dam.storagePct > 80);
    case "release": return dams.filter((dam) => dam.highRelease);
    case "watched": return dams.filter((dam) => Boolean(watch[`dam:${dam.id}`]));
  }
}

const normalize = (text: string) => text.toLocaleLowerCase("th").replace(/^เขื่อน\s*/, "").replace(/\s+/g, " ").trim();

/** Dams and river points whose Thai or English name contains the query; name-start matches first. */
export function findWater(query: string, dams: Dam[], rivers: { id: string; nameTh: string; nameEn: string }[], locale: "th" | "en", limit = 6): WaterHit[] {
  const q = normalize(query);
  if (!q) return [];
  const items = [
    ...dams.map((dam) => ({ kind: "dam" as const, id: dam.id, th: dam.nameTh, en: dam.nameEn })),
    ...rivers.map((river) => ({ kind: "river" as const, id: river.id, th: river.nameTh, en: river.nameEn })),
  ];
  return items.flatMap((item) => {
    const names = [normalize(item.th), normalize(item.en)];
    const rank = names.some((name) => name.startsWith(q)) ? 0 : names.some((name) => name.includes(q)) ? 1 : -1;
    return rank < 0 ? [] : [{ rank, hit: { kind: item.kind, id: item.id, name: locale === "en" ? item.en || item.th : item.th } }];
  }).sort((a, b) => a.rank - b.rank).slice(0, limit).map(({ hit }) => hit);
}

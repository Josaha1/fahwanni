import type { Dam } from "../dams/types";
import type { WaterWatch } from "./watchlist";
import { waterRivers, type WaterRiver } from "./rivers";

export type DamFilter = "all" | "full" | "release" | "watched";
export type WaterPointHit = { kind: "dam" | "river"; id: string; name: string };
export type WaterHit = WaterPointHit | {
  kind: "riverGroup";
  river: WaterRiver;
  points: string[];
  dams: string[];
  noPointReason?: WaterRiver["noPointReason"];
};

/** Dam markers kept by a water-mode filter chip; "full" means more than 80 % of capacity. */
export function filterDams(dams: Dam[], filter: DamFilter, watch: WaterWatch): Dam[] {
  switch (filter) {
    case "all": return dams;
    case "full": return dams.filter((dam) => dam.storagePct > 80);
    case "release": return dams.filter((dam) => dam.highRelease);
    case "watched": return dams.filter((dam) => Boolean(watch[`dam:${dam.id}`]));
  }
}

const normalize = (text: string) => text.toLocaleLowerCase("th").replace(/\s+/g, " ").trim()
  .replace(/^(?:เขื่อน|แม่น้ำ|ลำน้ำ)\s*|^น้ำ\s+/, "")
  .replace(/^(?:(?:river|the)(?:\s+|$))+/, "")
  .replace(/(?:^|\s+)(?:river|the)(?:\s+(?:river|the))*$/, "").trim();

/** River groups and direct name hits; points precede dams within each group, with limits per list. */
export function findWater(query: string, dams: Dam[], rivers: { id: string; nameTh: string; nameEn: string }[], locale: "th" | "en", limit = 6): WaterHit[] {
  const q = normalize(query);
  if (!q) return [];
  const rankNames = (names: string[]) => {
    const normalized = names.map(normalize);
    return normalized.some((name) => name.startsWith(q)) ? 0 : normalized.some((name) => name.includes(q)) ? 1 : -1;
  };
  const groups = waterRivers.flatMap((river) => {
    const rank = rankNames([river.nameTh, river.nameEn, ...river.aliases]);
    const hit: WaterHit = { kind: "riverGroup", river,
      points: river.points.filter((id) => rivers.some((point) => point.id === id)).slice(0, limit),
      dams: river.dams.filter((id) => dams.some((dam) => dam.id === id)).slice(0, limit),
      ...(river.noPointReason ? { noPointReason: river.noPointReason } : {}),
    };
    return rank < 0 ? [] : [{ rank, hit }];
  }).sort((a, b) => a.rank - b.rank).slice(0, limit);
  // Group members stay in their own lists, including when those lists reach the limit.
  const groupedIds = new Set(groups.flatMap(({ hit }) => hit.kind === "riverGroup"
    ? [...hit.river.points.map((id) => `river:${id}`), ...hit.river.dams.map((id) => `dam:${id}`)] : []));
  const items = [
    ...dams.map((dam) => ({ kind: "dam" as const, id: dam.id, th: dam.nameTh, en: dam.nameEn })),
    ...rivers.map((river) => ({ kind: "river" as const, id: river.id, th: river.nameTh, en: river.nameEn })),
  ];
  const direct = items.flatMap((item) => {
    if (groupedIds.has(`${item.kind}:${item.id}`)) return [];
    const rank = rankNames([item.th, item.en]);
    return rank < 0 ? [] : [{ rank, hit: { kind: item.kind, id: item.id, name: locale === "en" ? item.en || item.th : item.th } }];
  }).sort((a, b) => a.rank - b.rank).slice(0, limit);
  return [...direct, ...groups].sort((a, b) => a.rank - b.rank).map(({ hit }) => hit);
}

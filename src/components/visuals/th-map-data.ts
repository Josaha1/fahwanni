import { regionByProvince, type FloodRegion, type PixelCounts } from "@/lib/flood/viirs";
import { provinceBins, type SatelliteSample } from "@/lib/visuals";
import { thProjection, thProvinces } from "@/lib/visuals/th-provinces";
import type { T } from "@/i18n/core";

export const provinceColors = ["#86b9ad", "#fde047", "#fb923c", "#ef4444"];
export const noDataColor = "#9ca3af";
export type ThMapData = {
  counts: Record<string, PixelCounts> | null; samples: readonly SatelliteSample[];
  affected: readonly string[]; warnedRegions: readonly FloodRegion[];
};
export function provinceColor(counts: PixelCounts | null) {
  const bin = provinceBins(counts);
  return bin.state === "data" ? provinceColors[bin.bin] : noDataColor;
}
export function projectThailand(lon: number, lat: number): [number, number] {
  return [(lon - thProjection.west) * thProjection.cosLat * thProjection.scale,
    (thProjection.north - lat) * thProjection.scale];
}
export function floodPoints(samples: readonly SatelliteSample[]) {
  const flood = samples.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon)
    && (point.kind === "flood" || point.kind === "recurring-flood"));
  return flood.length <= 3000 ? flood : Array.from({ length: 3000 }, (_, i) => flood[Math.floor(i * (flood.length - 1) / 2999)]);
}
export function pathRings(d: string): [number, number][][] {
  return d.split("Z").filter(Boolean).map((ring) => ring.slice(1).split("L").map((pair) => pair.split(",").map(Number) as [number, number]));
}
// Shared arcs have identical simplified vertices. Cancel interior edges rather than
// drawing warning borders around every province in a region.
export function regionOutline(region: FloodRegion): string {
  const edges = new Map<string, [[number, number], [number, number]]>();
  for (const province of thProvinces) {
    if ((regionByProvince.get(province.id) ?? "central") !== region) continue;
    for (const ring of pathRings(province.d)) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const key = [a.join(","), b.join(",")].sort().join("/");
      if (edges.has(key)) edges.delete(key); else edges.set(key, [a, b]);
    }
  }
  return [...edges.values()].map(([a, b]) => `M${a.join(",")}L${b.join(",")}`).join("");
}
export const thRegionOutlines = Object.fromEntries(
  (["north", "northeast", "central", "east", "west", "south"] as FloodRegion[]).map((region) => [region, regionOutline(region)]),
) as Record<FloodRegion, string>;

export function visualSummaryThailand(data: ThMapData, t: T): string {
  const counts = data.counts ? Object.values(data.counts) : null;
  const total = counts?.some((count) => provinceBins(count).state === "data") ? counts.reduce((sum, count) => sum + count.flood + count.recurringFlood, 0) : undefined;
  return [total === undefined ? t("จังหวัด: ไม่มีข้อมูลที่ใช้ได้ · จุดตรวจ ไม่ใช่พื้นที่")
    : t("{n} จุดตรวจ", { n: new Intl.NumberFormat(t.locale === "en" ? "en-US" : "th-TH").format(total) }),
  t("{n} จังหวัดที่ระบุชื่อในรายงาน", { n: data.affected.length }),
  t("{n} ภาคมีประกาศเตือน", { n: data.warnedRegions.length })].join(" · ");
}

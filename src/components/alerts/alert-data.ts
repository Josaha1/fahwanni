import { eventProvinces, warningRegions } from "@/components/flood/home-data";
import type { FloodEventsPayload } from "@/components/water/flood-events";
import type { DamsPayload } from "@/lib/dams/client";
import type { TmdWarnings } from "@/lib/tmd";
import { warningKey } from "@/lib/tmd";
import { provinces } from "@/lib/provinces";
import { regionByProvince } from "@/lib/flood/viirs";

export type AlertRow = { id: string; role: "warn" | "water" | "release"; source: string; date?: string; href: string;
  warning?: TmdWarnings["items"][number]; event?: FloodEventsPayload["items"][number]; dam?: DamsPayload["dams"][number] };

export function alertRows(warnings: TmdWarnings | null, events: FloodEventsPayload | null, dams: DamsPayload | null): AlertRow[] {
  const rows: AlertRow[] = [
    ...(warnings?.items ?? []).map((warning) => {
      const text = `${warning.title} ${warning.description}`;
      const region = warningRegions(text)[0];
      const province = provinces.find((entry) => text.includes(entry.th) || text.toLowerCase().includes(entry.en.toLowerCase()))
        ?? provinces.find((entry) => region && regionByProvince.get(entry.id) === region);
      return { id: `tmd:${warningKey(warning)}`, role: "warn" as const, source: "TMD", date: warning.announcedAt,
        href: province ? `/province/${province.id}` : warning.url && /^https?:\/\//i.test(warning.url) ? warning.url : "/alerts", warning };
    }),
    ...(events?.items ?? []).map((event) => ({ id: event.id, role: "water" as const,
      source: event.source === "gdacs" ? "GDACS" : "GLIDE (ADRC) / HDX", date: event.endDate ?? event.date,
      href: eventProvinces(event)[0] ? `/province/${eventProvinces(event)[0].id}` : /^https?:\/\//i.test(event.url) ? event.url : "https://www.gdacs.org/", event })),
    ...(dams?.dams ?? []).filter((dam) => dam.storagePct > 80 || (dam.releaseCms !== null && dam.releaseCms >= 100)).map((dam) => ({
      id: `dam:${dam.id}`, role: "release" as const, source: "กรมชลประทาน", date: dam.date, href: `/dam/${dam.id}`, dam,
    })),
  ];
  const time = (date?: string) => date && Number.isFinite(Date.parse(date)) ? Date.parse(date) : -Infinity;
  return rows.sort((a, b) => time(b.date) - time(a.date) || a.id.localeCompare(b.id));
}

/**
 * Flood/disaster events in Thailand from two sources with published terms:
 * GDACS (flood events, Terms of Use) and ADRC GLIDE via HDX `tha-glide-events` (CC BY-IGO).
 */
export type FloodEventType = "flood" | "flash-flood" | "landslide" | "storm";

export interface FloodEvent {
  id: string;
  source: "gdacs" | "glide";
  type: FloodEventType;
  /** Start date YYYY-MM-DD (Asia/Bangkok calendar day as reported). */
  date: string;
  endDate: string | null;
  alert: "Green" | "Orange" | "Red" | null;
  lat: number;
  lon: number;
  /** As published (English); the UI labels it as the source's own text. */
  place: string;
  summary: string;
  url: string;
  glide: string | null;
}

export const FLOOD_EVENT_DAYS = 90;

const GLIDE_TYPES: Record<string, FloodEventType> = { FL: "flood", FF: "flash-flood", LS: "landslide", SL: "landslide", TC: "storm", ST: "storm" };

const decode = (text: string) => text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const clip = (text: string, max = 280) => text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
const pad = (value: number) => String(value).padStart(2, "0");
const recent = (date: string, nowMs: number, days: number) => {
  const at = Date.parse(`${date}T00:00:00+07:00`);
  return Number.isFinite(at) && at <= nowMs + 86_400_000 && nowMs - at <= days * 86_400_000;
};

type GeoJson = { features?: { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> }[] };

export function parseGlide(json: GeoJson, nowMs: number, days = FLOOD_EVENT_DAYS): FloodEvent[] {
  return (json.features ?? []).flatMap((feature) => {
    const p = feature.properties ?? {};
    const type = GLIDE_TYPES[String(p.event ?? "")];
    const [lon, lat] = Array.isArray(feature.geometry?.coordinates) ? feature.geometry!.coordinates as number[] : [];
    const year = Number(p.year), month = Number(p.month), day = Number(p.day);
    if (!type || !Number.isFinite(lat) || !Number.isFinite(lon) || !year || !month || !day) return [];
    const date = `${year}-${pad(month)}-${pad(day)}`;
    if (!recent(date, nowMs, days)) return [];
    const glide = typeof p.glidenumber === "string" && p.glidenumber ? p.glidenumber : null;
    return [{
      id: `glide:${glide ?? `${date}-${lat}-${lon}`}`, source: "glide" as const, type, date, endDate: null, alert: null, lat, lon,
      place: decode(String(p.location ?? "")), summary: clip(decode(String(p.comments ?? ""))),
      url: glide ? `https://glidenumber.net/glide/public/search/details.jsp?glide=${encodeURIComponent(glide)}` : "https://data.humdata.org/dataset/tha-glide-events",
      glide,
    }];
  });
}

export function parseGdacsFloods(json: GeoJson, nowMs: number, days = FLOOD_EVENT_DAYS): FloodEvent[] {
  return (json.features ?? []).flatMap((feature) => {
    const p = feature.properties ?? {};
    const [lon, lat] = Array.isArray(feature.geometry?.coordinates) ? feature.geometry!.coordinates as number[] : [];
    const from = typeof p.fromdate === "string" ? p.fromdate.slice(0, 10) : "";
    const to = typeof p.todate === "string" ? p.todate.slice(0, 10) : null;
    if (String(p.eventtype ?? "FL") !== "FL" || !p.eventid || !Number.isFinite(lat) || !Number.isFinite(lon) || !from) return [];
    if (!recent(to ?? from, nowMs, days)) return [];
    const alert = p.alertlevel === "Green" || p.alertlevel === "Orange" || p.alertlevel === "Red" ? p.alertlevel : null;
    const url = (p.url as { report?: string } | undefined)?.report ?? "https://www.gdacs.org/";
    return [{
      id: `gdacs:${p.eventid}`, source: "gdacs" as const, type: "flood" as const, date: from, endDate: to, alert, lat, lon,
      place: decode(String(p.country ?? "")), summary: clip(decode(String(p.description ?? p.name ?? ""))), url,
      glide: typeof p.glide === "string" && p.glide ? p.glide : null,
    }];
  });
}

/** GDACS first when both describe the same GLIDE event (it carries the alert level); newest first. */
export function mergeFloodEvents(gdacs: FloodEvent[], glide: FloodEvent[]): FloodEvent[] {
  const linked = new Set(gdacs.flatMap((event) => event.glide ? [event.glide] : []));
  return [...gdacs, ...glide.filter((event) => !event.glide || !linked.has(event.glide))]
    .sort((a, b) => (b.endDate ?? b.date).localeCompare(a.endDate ?? a.date) || a.id.localeCompare(b.id));
}

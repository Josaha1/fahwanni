import type { Params } from "@/i18n/core";
import type { WatchKey } from "./watchlist";

const KEY = "fah-water-seen";

export type NewsItem = { key: WatchKey; label: string; value: number; unit: "pct" | "cms"; status?: string; date: string };
export type Seen = { at: string; items: Record<WatchKey, { value: number; status?: string; date: string }> };
export type News = { key: WatchKey; label: string; kind: "status" | "change" | "new-data"; text: string; params: Params };

export function readSeen(): Seen | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const seen = value as Seen;
    if (typeof seen.at !== "string" || !seen.items || typeof seen.items !== "object" || Array.isArray(seen.items)) return null;
    const items = Object.fromEntries(Object.entries(seen.items).filter(([key, item]) =>
      /^(dam|river):.+$/.test(key) && item && Number.isFinite(item.value) && typeof item.date === "string" &&
      (item.status === undefined || typeof item.status === "string"))) as Seen["items"];
    return { at: seen.at, items };
  } catch { return null; }
}

export function diffSinceSeen(seen: Seen | null, current: NewsItem[]): News[] {
  if (!seen) return [];
  const news: News[] = [];
  for (const item of current) {
    const previous = seen.items[item.key];
    if (!previous) continue;
    if (item.status !== previous.status) {
      news.push({ key: item.key, label: item.label, kind: "status", text: "{label}: {from} → {to}",
        params: { label: item.label, from: previous.status ?? "—", to: item.status ?? "—" } });
    } else if (item.key.startsWith("dam:") ? Math.abs(item.value - previous.value) > 3
      : previous.value === 0 ? item.value !== 0 : Math.abs(item.value - previous.value) / Math.abs(previous.value) > 0.15) {
      news.push({ key: item.key, label: item.label, kind: "change", text: "{label}: {from} → {to} {unit}",
        params: { label: item.label, from: previous.value, to: item.value, unit: item.unit === "pct" ? "%" : "m³/s" } });
    } else if (item.date > previous.date) {
      news.push({ key: item.key, label: item.label, kind: "new-data", text: "{label}: ข้อมูลวันที่ {date}",
        params: { label: item.label, date: item.date } });
    }
  }
  const priority = { status: 0, change: 1, "new-data": 2 };
  return news.sort((a, b) => priority[a.kind] - priority[b.kind]);
}

export function markSeen(current: NewsItem[]): Seen {
  const seen: Seen = { at: new Date().toISOString(), items: Object.fromEntries(current.map((item) =>
    [item.key, { value: item.value, ...(item.status === undefined ? {} : { status: item.status }), date: item.date }])) as Seen["items"] };
  try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch { /* Keep the snapshot for this visit. */ }
  return seen;
}

export function hasNews(seen: Seen | null, current: NewsItem[]): boolean {
  return diffSinceSeen(seen, current).length > 0;
}

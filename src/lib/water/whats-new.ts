import type { Params } from "@/i18n/core";
import type { WatchKey } from "./watchlist";

const KEY = "fah-water-seen";

export type NewsItem = { key: WatchKey; label: string; value: number; unit: "pct" | "cms"; status?: string; date: string };
export type Seen = { at: string; items: Record<WatchKey, { value: number; status?: string; date: string }>; followed?: FollowSnapshot };
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
    return { at: seen.at, items, followed: validFollowSnapshot(seen.followed) ? seen.followed : undefined };
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
  const seen: Seen = { followed: readSeen()?.followed, at: new Date().toISOString(), items: Object.fromEntries(current.map((item) =>
    [item.key, { value: item.value, ...(item.status === undefined ? {} : { status: item.status }), date: item.date }])) as Seen["items"] };
  try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch { /* Keep the snapshot for this visit. */ }
  return seen;
}

export function hasNews(seen: Seen | null, current: NewsItem[]): boolean {
  return diffSinceSeen(seen, current).length > 0;
}

export type FollowValue = { value: number; date: string; source: string };
export type FollowEntry = { release?: FollowValue; pct?: FollowValue; water?: FollowValue; warnings?: { ids: string[]; date: string } };
export type FollowSnapshot = Record<string, FollowEntry>;
export type FollowChange = { key: string; kind: "release" | "pct" | "water" | "warning"; from: number; to: number;
  source: string; date: string; warningId?: string; title?: string };

function validFollowSnapshot(value: unknown): value is FollowSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, entry]) => {
    if (!/^(dam|province):.+$/.test(key) || !entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const item = entry as FollowEntry;
    return [item.release, item.pct, item.water].every((metric) => metric === undefined ||
      !!metric && Number.isFinite(metric.value) && metric.value >= 0 && typeof metric.date === "string" && typeof metric.source === "string")
      && (item.warnings === undefined || !!item.warnings && Array.isArray(item.warnings.ids)
        && item.warnings.ids.every((id) => typeof id === "string") && typeof item.warnings.date === "string");
  });
}

export function diffFollowed(prev: FollowSnapshot | null, next: FollowSnapshot): FollowChange[] {
  if (!prev) return [];
  const changes: FollowChange[] = [];
  for (const [key, item] of Object.entries(next)) {
    const before = prev[key];
    if (!before) continue;
    for (const kind of ["release", "pct", "water"] as const) {
      const old = before[kind], current = item[kind];
      if (!old || !current || !Number.isFinite(old.value) || !Number.isFinite(current.value) || current.date < old.date) continue;
      const from = old.value, to = current.value;
      const crossed = (threshold: number) => from < threshold && to >= threshold || from >= threshold && to < threshold;
      const changed = kind === "release" ? to > from && (to >= from * 1.2 || from < 100 && to >= 100)
        : kind === "pct" ? crossed(80) || crossed(100)
        : to > from && (from === 0 || to >= from * 1.5);
      if (changed) changes.push({ key, kind, from, to, source: current.source, date: current.date });
    }
    if (before.warnings && item.warnings && item.warnings.date >= before.warnings.date) {
      for (const id of item.warnings.ids.filter((id) => !before.warnings!.ids.includes(id))) {
        const separator = id.indexOf("|");
        changes.push({ key, kind: "warning", from: 0, to: 1, source: "TMD", date: (separator < 0 ? "" : id.slice(0, separator)) || item.warnings.date,
          warningId: id, title: separator < 0 ? undefined : id.slice(separator + 1) });
      }
    }
  }
  return changes;
}

/** Missing and older reports keep the last reported value for the next visit. */
export function mergeFollowed(prev: FollowSnapshot, next: FollowSnapshot): FollowSnapshot {
  const merged = { ...prev };
  for (const [key, item] of Object.entries(next)) {
    const entry = { ...prev[key] };
    for (const kind of ["release", "pct", "water", "warnings"] as const) {
      const current = item[kind];
      if (current && (!entry[kind] || current.date >= entry[kind]!.date)) Object.assign(entry, { [kind]: current });
    }
    merged[key] = entry;
  }
  return merged;
}

export function saveFollowed(followed: FollowSnapshot): void {
  const seen = readSeen() ?? { at: new Date().toISOString(), items: {} };
  try { localStorage.setItem(KEY, JSON.stringify({ ...seen, followed })); }
  catch { /* Keep the snapshot for this visit when storage is unavailable. */ }
}

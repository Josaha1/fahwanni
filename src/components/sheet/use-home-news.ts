"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { useFavourites, useLastPlace } from "@/hooks/use-favourites";
import { distanceKm } from "@/lib/storms/normalize";
import { diffSinceSeen, markSeen, readSeen, type NewsItem } from "@/lib/water/whats-new";
import { readWatch } from "@/lib/water/watchlist";
import { statusWord } from "@/lib/rivers/status";
import type { RiversPayload } from "@/components/water/river-details";
import type { Dam } from "@/lib/dams/types";

export function useHomeNews(dams: Dam[], rainSelected: boolean) {
  const t = useT();
  const { place } = useLastPlace();
  const { favourites } = useFavourites();
  const [seen, setSeen] = useState(readSeen);
  const [watch, setWatch] = useState(readWatch);
  const [rivers, setRivers] = useState<RiversPayload | null>(null);
  useEffect(() => {
    const update = () => { setSeen(readSeen()); setWatch(readWatch()); };
    window.addEventListener("fah-water-seen-change", update);
    window.addEventListener("fah-water-watch-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("fah-water-seen-change", update);
      window.removeEventListener("fah-water-watch-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  useEffect(() => {
    // The existing rivers endpoint also fetches GloFAS: defer it with the rain lens.
    if (!rainSelected) return;
    const controller = new AbortController();
    fetch("/api/rivers", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as RiversPayload;
      if (!controller.signal.aborted && Array.isArray(data.points)) setRivers(data);
    }).catch(() => {});
    return () => controller.abort();
  }, [rainSelected]);
  const nearest = new Set([place, ...favourites].flatMap((location) => [...(rivers?.points ?? [])]
    .sort((a, b) => distanceKm(location, a) - distanceKm(location, b)).slice(0, 3).map((point) => point.id)));
  const items: NewsItem[] = [
    ...dams.filter((dam) => watch[`dam:${dam.id}`]).map((dam) => ({ key: `dam:${dam.id}` as const,
      label: t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh, value: dam.storagePct, unit: "pct" as const, date: dam.date })),
    ...(rivers?.points ?? []).filter((point) => point.summary && (nearest.has(point.id) || watch[`river:${point.id}`])).map((point) => ({
      key: `river:${point.id}` as const, label: t.locale === "en" ? point.nameEn || point.nameTh : point.nameTh,
      value: point.summary!.today.value, unit: "cms" as const, status: statusWord(point.summary!.today.status), date: point.summary!.today.date,
    })),
  ];
  return { news: diffSinceSeen(seen, items), items, watch, markRead: () => {
    // Retain river snapshots until the deferred source has actually loaded.
    const missing = Object.entries(seen?.items ?? {}).filter(([key]) => !items.some((item) => item.key === key))
      .map(([key, item]) => ({ key: key as NewsItem["key"], label: key, unit: key.startsWith("dam:") ? "pct" as const : "cms" as const, ...item }));
    setSeen(markSeen([...missing, ...items]));
    window.dispatchEvent(new Event("fah-water-seen-change"));
  } };
}

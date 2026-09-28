"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import type { Place } from "@/lib/place";
import { distanceKm, type Storm } from "@/lib/storms/normalize";
import { gdacsLevelLabel, stormMessage } from "@/lib/storms/present";
import type { TmdWarning } from "@/lib/tmd";

type BannerData = { storms: Storm[]; items: TmdWarning[] };
let cached: { data: BannerData; until: number } | undefined;
let pending: Promise<BannerData> | undefined;

async function json(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Warning source returned ${response.status}`);
  return response.json();
}

async function load(): Promise<BannerData> {
  if (cached && Date.now() < cached.until) return cached.data;
  if (pending) return pending;
  pending = Promise.allSettled([json("/api/storms"), json("/api/tmd-warnings")]).then(([storms, tmd]) => {
    const stormData = storms.status === "fulfilled" ? storms.value as { storms?: Storm[] } : undefined;
    const tmdData = tmd.status === "fulfilled" ? tmd.value as { items?: TmdWarning[] } : undefined;
    const data = {
      storms: Array.isArray(stormData?.storms) ? stormData.storms : [],
      items: Array.isArray(tmdData?.items) ? tmdData.items : [],
    };
    cached = { data, until: Date.now() + 15 * 60 * 1000 };
    return data;
  }).finally(() => { pending = undefined; });
  return pending;
}

export function StormBanner({ place }: { place: Place }) {
  const t = useT();
  const [data, setData] = useState<BannerData | undefined>(cached?.data);

  useEffect(() => {
    let active = true;
    load().then((result) => { if (active) setData(result); });
    return () => { active = false; };
  }, []);

  if (!data || (data.storms.length === 0 && data.items.length === 0)) return null;
  const placeName = place.source === "gps" ? t("ตำแหน่งปัจจุบัน") : t.locale === "en" && place.source === "province" ? place.admin ?? place.name : place.name;

  return (
    <section aria-label={t("ประกาศพายุและคำเตือน")} className="space-y-3">
      {data.storms.map((storm) => {
        const nearby = distanceKm(place, storm.position) < 500;
        return <article key={`${storm.source}:${storm.id}`} className={`placeholder-card border-l-4 ${nearby ? "border-l-zone-alert-ink" : "border-l-zone-warn-ink"}`}>
          <p className="font-semibold">{stormMessage(storm, { ...place, name: placeName }, t)}</p>
          {storm.source === "gdacs" && storm.alertLevel && <p className="mt-1 text-sm">{gdacsLevelLabel(storm.alertLevel, t)}</p>}
          <p className="mt-2 text-xs text-muted">{storm.source === "jma" ? t("ที่มา: Japan Meteorological Agency") : t("ที่มา: GDACS")}</p>
        </article>;
      })}
      {data.items.map((item, index) => <article key={`${item.title}:${index}`} className="placeholder-card border-l-4 border-l-zone-warn-ink">
        <h2 className="text-lg">{item.title}</h2>
        <details className="mt-2">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-given focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given">{t("ดูเพิ่มเติม")}</summary>
          <p className="whitespace-pre-line text-sm">{item.description}</p>
        </details>
        <p className="mt-2 text-xs text-muted">{t("ที่มา: กรมอุตุนิยมวิทยา")}</p>
      </article>)}
    </section>
  );
}

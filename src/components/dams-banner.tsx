"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import type { DamsPayload } from "@/lib/dams/client";
import { upstreamDamsFor, type DamDownstreamFile, type UpstreamDam } from "@/lib/dams/near";
import type { DamPath } from "@/lib/dams/paths";
import type { Place } from "@/lib/place";

type DamPathsFile = { type: "FeatureCollection"; features: DamPath[] };

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Dam source returned ${response.status}`);
  return response.json() as Promise<T>;
}

export function DamsBanner({ place }: { place: Place }) {
  const t = useT();
  const [result, setResult] = useState<{ lat: number; lon: number; items: UpstreamDam[] } | null>(null);

  useEffect(() => {
    if (place.lon < 97.3 || place.lon > 105.7 || place.lat < 5.6 || place.lat > 20.5) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      Promise.all([
        getJson<DamsPayload>("/api/dams", controller.signal),
        getJson<DamPathsFile>("/data/dam-paths.geojson", controller.signal),
        getJson<DamDownstreamFile>("/data/dam-downstream.json", controller.signal),
      ]).then(([dams, paths, downstream]) => {
        if (!controller.signal.aborted) setResult({ lat: place.lat, lon: place.lon, items: upstreamDamsFor(place, { dams, paths, downstream }) });
      }).catch(() => { if (!controller.signal.aborted) setResult({ lat: place.lat, lon: place.lon, items: [] }); });
    }, 1500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [place]);

  const items = result?.lat === place.lat && result.lon === place.lon ? result.items : [];
  if (items.length === 0) return null;
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 0 });

  return <section className="placeholder-card border-l-4 border-l-zone-warn-ink" aria-label={t("เขื่อนเหนือน้ำของคุณ")}>
    <h2 className="text-lg">{t("เขื่อนเหนือน้ำของคุณ")}</h2>
    <div className="mt-2 space-y-3">
      {items.map((item) => {
        const detail = [
          t("กักเก็บ {n}%", { n: number.format(item.storagePct) }),
          item.releaseCms === null ? null : t("ระบาย {n} ลบ.ม./วินาที", { n: number.format(item.releaseCms) }),
        ].filter(Boolean).join(" · ");
        return <div key={item.damId}>
          <p className="font-semibold">{t("{name} · ห่างขึ้นไปตามลำน้ำ ~{km} กม.", {
            name: t.locale === "en" ? item.nameEn || item.nameTh : item.nameTh,
            km: number.format(item.kmToUser),
          })}</p>
          {detail && <p className="text-sm">{detail}</p>}
          <a className="mt-1 inline-flex min-h-11 items-center font-semibold text-given underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given" href={`/map?ov=dams&dam=${encodeURIComponent(item.damId)}`}>{t("ดูทิศทางน้ำบนแผนที่")}</a>
        </div>;
      })}
    </div>
    <p className="mt-2 text-xs text-muted">{t("ข้อมูล: กรมชลประทาน · ไม่ใช่การพยากรณ์น้ำท่วม")}</p>
  </section>;
}

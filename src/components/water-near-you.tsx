"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import type { DamsPayload } from "@/lib/dams/client";
import { upstreamDamsFor, type DamDownstreamFile, type UpstreamDam } from "@/lib/dams/near";
import type { DamPath } from "@/lib/dams/paths";
import type { Place } from "@/lib/place";
import { riverColors } from "@/lib/rivers/colors";
import { statusWord } from "@/lib/rivers/status";
import type { RiverStatus, RiverTrend } from "@/lib/rivers/types";
import { distanceKm } from "@/lib/storms/normalize";
import type { TmdWarnings } from "@/lib/tmd";
import { diffSinceSeen, readSeen, type NewsItem } from "@/lib/water/whats-new";
import { readWatch } from "@/lib/water/watchlist";

type DamPathsFile = { type: "FeatureCollection"; features: DamPath[] };
type RiverRow = { id: string; nameTh: string; nameEn: string; lat: number; lon: number;
  summary: null | { today: { date: string; value: number; status: RiverStatus }; trend: RiverTrend | null } };
type RiversPayload = { points: RiverRow[] };
type Result = { lat: number; lon: number; dams: DamsPayload | null; rivers: RiversPayload | null;
  warnings: TmdWarnings | null; items: UpstreamDam[] };

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Water source returned ${response.status}`);
  return response.json() as Promise<T>;
}

function value<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

/** A river point farther than this is not "near you" (Phuket → Surat Thani is ~170 km). */
const NEAR_RIVER_KM = 120;

export function WaterNearYou({ place }: { place: Place }) {
  const t = useT();
  const [result, setResult] = useState<Result | null>(null);
  const inThailand = place.lon >= 97.3 && place.lon <= 105.7 && place.lat >= 5.6 && place.lat <= 20.5;

  useEffect(() => {
    if (!inThailand) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      Promise.allSettled([
        getJson<DamsPayload>("/api/dams", controller.signal),
        getJson<DamPathsFile>("/data/dam-paths.geojson", controller.signal),
        getJson<DamDownstreamFile>("/data/dam-downstream.json", controller.signal),
        getJson<RiversPayload>("/api/rivers", controller.signal),
        getJson<TmdWarnings & { error?: string }>("/api/tmd-warnings", controller.signal),
      ]).then(([damResult, pathResult, downstreamResult, riverResult, warningResult]) => {
        if (controller.signal.aborted) return;
        const dams = value(damResult);
        const paths = value(pathResult);
        const downstream = value(downstreamResult);
        const rivers = value(riverResult);
        const warnings = value(warningResult);
        setResult({ lat: place.lat, lon: place.lon,
          dams: Array.isArray(dams?.dams) ? dams : null,
          rivers: Array.isArray(rivers?.points) ? rivers : null,
          warnings: Array.isArray(warnings?.items) && !warnings.error ? warnings : null,
          items: dams && paths && downstream && Array.isArray(dams.dams)
            ? upstreamDamsFor(place, { dams, paths, downstream }) : [],
        });
      });
    }, 1500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [place, inThailand]);

  const data = inThailand && result?.lat === place.lat && result.lon === place.lon ? result : null;
  if (!data || (!data.dams && !data.rivers && !data.warnings)) return null;

  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 0 });
  const nearbyRivers = (data.rivers?.points ?? []).map((point) => ({ point, km: distanceKm(place, point) }))
    .sort((a, b) => a.km - b.km || a.point.id.localeCompare(b.point.id));
  const nearest = nearbyRivers.find(({ point, km }) => km <= NEAR_RIVER_KM && point.summary)?.point ?? null;
  const watch = readWatch();
  const riverIds = new Set(nearbyRivers.slice(0, 3).map(({ point }) => point.id));
  const newsItems: NewsItem[] = [
    ...(data.rivers?.points ?? []).filter((point) => point.summary && (riverIds.has(point.id) || watch[`river:${point.id}`]))
      .map((point) => ({ key: `river:${point.id}` as const, label: t.locale === "en" ? point.nameEn || point.nameTh : point.nameTh,
        value: point.summary!.today.value, unit: "cms" as const, status: statusWord(point.summary!.today.status), date: point.summary!.today.date })),
    ...(data.dams?.dams ?? []).filter((dam) => watch[`dam:${dam.id}`])
      .map((dam) => ({ key: `dam:${dam.id}` as const, label: t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh,
        value: dam.storagePct, unit: "pct" as const, date: dam.date })),
  ];
  const news = diffSinceSeen(readSeen(), newsItems)[0];
  const borderColor = data.items.length || nearest?.summary?.today.status === "veryHigh"
    ? "var(--zone-warn-ink)" : riverColors.normal;

  return <section className="placeholder-card border-l-4" style={{ borderLeftColor: borderColor }} aria-label={t("น้ำใกล้คุณ")}>
    <h2 className="text-lg">{t("น้ำใกล้คุณ")}</h2>
    {nearest?.summary && <p className="mt-2 truncate text-sm">
      <span style={{ color: riverColors[nearest.summary.today.status] }}>{t("{name}: {status} {trend}", {
        name: t.locale === "en" ? nearest.nameEn || nearest.nameTh : nearest.nameTh,
        status: t(statusWord(nearest.summary.today.status)),
        trend: nearest.summary.trend === "rising" ? "↗" : nearest.summary.trend === "falling" ? "↘" : "→",
      })}</span> <span className="text-muted">{t("(แบบจำลอง)")}</span>
    </p>}
    {data.items.length > 0 && <div className="mt-2 space-y-3">
      {data.items.map((item) => {
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
    </div>}
    {news && <p className="mt-2 truncate text-sm"><span className="font-semibold">{t("มีอะไรใหม่")}: </span>{t(news.text, {
      ...news.params, from: t(String(news.params.from ?? "—")), to: t(String(news.params.to ?? "—")),
    })}</p>}
    {data.warnings?.items[0] && <p className="mt-2 truncate text-sm">⚠ {data.warnings.items[0].title}</p>}
    <Link className="mt-2 inline-flex min-h-11 items-center font-semibold text-given underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given" href="/water">{t("ดูสถานการณ์น้ำทั้งหมด")}</Link>
    <p className="map-muted mt-2 text-xs text-muted">{t("ข้อมูล: กรมชลประทาน · แบบจำลอง GloFAS · ไม่ใช่การพยากรณ์น้ำท่วม")}</p>
  </section>;
}

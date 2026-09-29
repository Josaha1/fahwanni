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
  if (!data) return null;

  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 0 });
  const nearbyRivers = (data.rivers?.points ?? []).map((point) => ({ point, km: distanceKm(place, point) }))
    .sort((a, b) => a.km - b.km || a.point.id.localeCompare(b.point.id));
  const nearest = nearbyRivers.find(({ point, km }) => km <= NEAR_RIVER_KM && point.summary)?.point ?? null;
  const riverStatus = nearest?.summary?.today.status;
  const riverSummary = nearest?.summary ? t("{name}: {status} {trend}", {
    name: t.locale === "en" ? nearest.nameEn || nearest.nameTh : nearest.nameTh,
    status: t(statusWord(nearest.summary.today.status)),
    trend: nearest.summary.trend === "rising" ? "↗" : nearest.summary.trend === "falling" ? "↘" : "→",
  }) : null;
  const dam = data.items[0];
  const detail = data.warnings?.items[0] ? `⚠ ${data.warnings.items[0].title}` : dam ? t("{name} กักเก็บ {pct}% · ระบาย {cms} ลบ.ม./วินาที · ~{km} กม.", {
    name: t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh,
    pct: number.format(dam.storagePct),
    cms: dam.releaseCms === null ? "—" : number.format(dam.releaseCms),
    km: number.format(dam.kmToUser),
  }) : null;
  const borderColor = data.items.length || riverStatus === "veryHigh"
    ? "var(--zone-warn-ink)" : riverColors.normal;

  return <Link className="placeholder-card block min-h-11 border-l-4 px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given" style={{ borderLeftColor: borderColor }} href="/water"
    aria-label={t("น้ำใกล้คุณ: {summary}", { summary: riverSummary ? `${riverSummary} ${t("(แบบจำลอง)")}` : detail ?? t("ดูสถานการณ์น้ำ") })}>
    <span className="flex items-center justify-between gap-2 font-semibold">{t("น้ำใกล้คุณ")}<span aria-hidden="true">›</span></span>
    {/* Each line clamps on its own, so the second line is never swallowed by a long first line. */}
    <div className="mt-1 space-y-0.5 text-sm">
      {riverSummary && riverStatus ? <p className="line-clamp-2">
        <span className="mr-1 inline-block size-2 rounded-full" style={{ backgroundColor: riverColors[riverStatus] }} aria-hidden="true" />
        {riverSummary} <span className="whitespace-nowrap text-muted">{t("(แบบจำลอง)")}</span>
      </p> : !detail && <p>{t("ดูสถานการณ์น้ำ")}</p>}
      {detail && <p className="line-clamp-1 text-muted">{detail}</p>}
    </div>
  </Link>;
}

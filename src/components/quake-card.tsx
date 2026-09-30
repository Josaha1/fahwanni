"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { nearbyQuakes, QUAKE_ATTRIBUTION } from "@/lib/quakes/near";
import type { Quake } from "@/lib/quakes/usgs";
import { bearingWord } from "@/lib/storms/present";

function ago(iso: string, nowMs: number, t: ReturnType<typeof useT>): string {
  const hours = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 3_600_000));
  if (hours < 1) return t("เมื่อสักครู่");
  if (hours < 24) return t("{n} ชม. ที่แล้ว", { n: hours });
  return t("{n} วันที่แล้ว", { n: Math.round(hours / 24) });
}

/** Recent M4+ earthquakes within 1,000 km (last 7 days); hidden when there are none. */
export function QuakeCard({ lat, lon }: { lat: number; lon: number }) {
  const t = useT();
  const [quakes, setQuakes] = useState<Quake[]>([]);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/quakes", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() as Promise<{ quakes: Quake[] }> : { quakes: [] }))
      .then((data) => setQuakes(data.quakes ?? []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const nearby = nearbyQuakes(quakes, { lat, lon }, new Date(now).toISOString()).slice(0, 3);
  if (nearby.length === 0) return null;
  return (
    <section className="placeholder-card" aria-label={t("แผ่นดินไหวใกล้คุณ")}>
      <h2 className="text-xl">{t("แผ่นดินไหวใกล้คุณ")}</h2>
      <p className="text-sm text-muted">{t("ขนาด 4 ขึ้นไป ภายใน 1,000 กม. ใน 7 วันที่ผ่านมา")}</p>
      <ul className="mt-3 space-y-2">
        {nearby.map((q) => (
          <li key={q.id} className="flex items-start gap-3 rounded-xl bg-background px-3 py-2">
            <strong className={`shrink-0 text-lg ${q.mag >= 5.5 ? "text-zone-alert-ink" : ""}`}>M{q.mag.toFixed(1)}</strong>
            <span className="min-w-0 text-sm">
              <span className="block">{t("ห่าง ~{km} กม. ทางทิศ{dir}", { km: q.distanceKm.toLocaleString(), dir: bearingWord(q.bearingDeg, t) })} · {ago(q.time, now, t)}</span>
              <span className="block truncate text-xs text-muted">{q.place}{q.tsunami ? ` · ${t("มีการประเมินสึนามิ")}` : ""}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        <a className="underline" href="https://earthquake.tmd.go.th" target="_blank" rel="noopener noreferrer">{t("ประกาศทางการ: กองเฝ้าระวังแผ่นดินไหว กรมอุตุฯ")}</a>
        {" · "}<a className="underline" href={QUAKE_ATTRIBUTION.url} target="_blank" rel="noopener noreferrer">{QUAKE_ATTRIBUTION.text}</a>
      </p>
    </section>
  );
}

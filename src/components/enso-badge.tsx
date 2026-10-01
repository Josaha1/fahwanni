"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import type { EnsoStatus } from "@/lib/enso";

const STRENGTH = { weak: "อ่อน", moderate: "ปานกลาง", strong: "แรง", "very-strong": "แรงมาก" } as const;

/** El Niño / La Niña now (NOAA CPC ONI) with what it usually means for Thailand. Hidden when neutral or unavailable. */
export function EnsoBadge({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const [status, setStatus] = useState<EnsoStatus | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/enso", { signal: controller.signal }).then((response) => response.ok ? response.json() as Promise<EnsoStatus> : null)
      .then((data) => { if (data && "phase" in data) setStatus(data); }).catch(() => {});
    return () => controller.abort();
  }, []);
  if (!status || status.phase === "neutral" || !status.strength) return null;
  const nino = status.phase === "el-nino";
  const value = `${status.latest.anomaly > 0 ? "+" : ""}${status.latest.anomaly.toFixed(1)}`;
  const title = t(nino ? "สภาพเอลนีโญ ระดับ{strength}" : "สภาพลานีญา ระดับ{strength}", { strength: t(STRENGTH[status.strength]) });
  const effect = t(nino ? "ประเทศไทยมักฝนน้อยกว่าปกติ อากาศร้อน และเสี่ยงแล้งในหน้าแล้งถัดไป" : "ประเทศไทยมักฝนมากกว่าปกติ และเสี่ยงน้ำท่วมมากขึ้น");
  if (compact) return <p className="text-sm"><span aria-hidden="true">{nino ? "🌡️" : "🌧️"}</span> <strong>{title}</strong> · {effect}</p>;
  return <section className="placeholder-card space-y-1" aria-label={title}>
    <h2 className="text-lg font-semibold"><span aria-hidden="true">{nino ? "🌡️" : "🌧️"}</span> {title}</h2>
    <p className="text-sm">{effect}</p>
    <p className="text-muted text-xs">{t("ดัชนี ONI {value}°C ({season} {year}) · {official} · ที่มา NOAA CPC", {
      value, season: status.latest.season, year: status.latest.year,
      official: t(status.officialEpisode ? "ครบนิยามทางการแล้ว" : "ยังไม่ครบ 5 ช่วงตามนิยามทางการ ({n}/5)", { n: status.run }),
    })}</p>
  </section>;
}

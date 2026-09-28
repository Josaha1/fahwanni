"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import type { MarineSnapshot, WaveLevel } from "@/lib/marine";

const LEVEL: Record<WaveLevel, { label: string; advice: string }> = {
  calm: { label: "คลื่นลมสงบ", advice: "ทะเลเรียบ เล่นน้ำ/ออกเรือได้ตามปกติ" },
  moderate: { label: "คลื่นปานกลาง", advice: "เรือเล็กควรระวัง" },
  high: { label: "คลื่นสูง", advice: "เรือเล็กควรงดออกจากฝั่ง" },
  "very-high": { label: "คลื่นสูงมาก", advice: "งดออกจากฝั่งและงดเล่นน้ำทะเล" },
};

/** Sea state for places within ~30 km of the coast; renders nothing inland. */
export function MarineCard({ lat, lon }: { lat: number; lon: number }) {
  const t = useT();
  const [marine, setMarine] = useState<MarineSnapshot | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/marine?lat=${lat}&lon=${lon}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() as Promise<MarineSnapshot> : null))
      .then((data) => setMarine(data))
      .catch(() => {});
    return () => controller.abort();
  }, [lat, lon]);

  if (!marine?.available || marine.maxWaveM === undefined || !marine.level) return null;
  const { label, advice } = LEVEL[marine.level];
  const strong = marine.level === "high" || marine.level === "very-high";
  return (
    <section className="placeholder-card" aria-label={t("คลื่นลมทะเล")}>
      <h2 className="text-xl">{t("คลื่นลมทะเล")}</h2>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <strong className="text-4xl leading-tight">{t("{m} ม.", { m: marine.maxWaveM })}</strong>
        <span className="text-sm text-muted">{t("คลื่นสูงสุดใน 24 ชม.")}</span>
      </div>
      <p className={`mt-1 font-semibold ${strong ? "text-zone-alert-ink" : ""}`}>{t(label)} · {t(advice)}</p>
      {marine.periodS !== undefined && <p className="mt-1 text-sm text-muted">{t("คาบคลื่น ~{s} วินาที", { s: marine.periodS })}</p>}
      <p className="mt-2 text-xs text-muted"><a className="underline" href={marine.attribution.url} target="_blank" rel="noopener noreferrer">{marine.attribution.text}</a></p>
    </section>
  );
}

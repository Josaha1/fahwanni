"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useLite } from "@/hooks/use-lite";
import { useT } from "@/i18n/client";
import { SourceTime } from "@/components/ui/source-time";
import type { Dam } from "@/lib/dams/types";
import type { DamTrend } from "@/lib/dams/trend";
import { getSceneHost } from "@/lib/three/scene-host";
import { visualSummaryTank } from "@/lib/visuals";
import { tankGridData, type TankEntry } from "./tank-grid-data";

export function GridTankSvg({ entry }: { entry: TankEntry }) {
  const { fill, release, inflow, id } = entry;
  const y = fill.state === "data" ? 140 - fill.height * 100 : 19;
  return <svg viewBox="0 0 160 165" className="h-full w-full" aria-hidden="true">
    <defs><pattern id={`missing-${id}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#9ca3af" opacity="0.2" /><line x1="0" x2="0" y2="8" stroke="#9ca3af" strokeWidth="3" /></pattern></defs>
    <rect data-tank-fill="" x="42" y={y} width="76" height={140 - y} fill={fill.state === "data" ? fill.color : `url(#missing-${id})`} opacity="0.75" />
    <path d="M40 19V140H120V19" fill="none" stroke="currentColor" strokeWidth="2" />
    <line data-crest="" x1="34" x2="126" y1="40" y2="40" stroke="currentColor" strokeDasharray="4 3" />
    {inflow.state === "data" && inflow.ratio > 0 && <path data-stream="inflow" d="M4 65H36M29 59L36 65L29 71" fill="none" stroke={fill.state === "data" ? fill.color : "#9ca3af"} strokeWidth={inflow.ratio * 6} />}
    {release.state === "data" && release.ratio > 0 && <path data-stream="release" d="M124 123H156M149 117L156 123L149 129" fill="none" stroke={fill.state === "data" ? fill.color : "#9ca3af"} strokeWidth={release.ratio * 6} />}
  </svg>;
}

export function TankGrid({ dams, date, trend }: { dams: readonly Dam[]; date: string | null; trend: DamTrend | null }) {
  const t = useT();
  const { lite, reducedMotion } = useLite();
  const grid = useRef<HTMLDivElement>(null);
  const entries = useMemo(() => tankGridData(dams, date, trend), [dams, date, trend]);
  useEffect(() => {
    let active = true;
    let dispose: (() => void) | undefined;
    const root = grid.current!;
    void getSceneHost({ lite, reducedMotion }).then(async (host) => {
      if (!active || host.tier === "svg") return;
      const { attachTankGrid } = await import("./tank-grid-scene");
      if (active) dispose = attachTankGrid(host, root, entries);
    }).catch(() => { /* The SVG and its caption remain available if initialization fails. */ });
    return () => { active = false; dispose?.(); };
  }, [entries, lite, reducedMotion]);
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  return <section className="placeholder-card space-y-2" aria-label={t("เขื่อนทั้งหมด")}>
    <h2 className="text-lg font-semibold">{t("เขื่อนทั้งหมด")}</h2>
    <p className="text-muted text-xs">{t("เส้นประ = เต็มความจุ 100% · ลูกศร = ไหลเข้า/ระบาย")}</p>
    <SourceTime source="กรมชลประทาน" date={date} kind="daily" />
    <div ref={grid} className="grid grid-cols-4 gap-1 min-[360px]:grid-cols-5 lg:grid-cols-7" style={{ touchAction: "pan-y" }}>
      {entries.map((entry) => {
        const summary = visualSummaryTank(entry.fill, t);
        const name = t.locale === "en" ? entry.nameEn : entry.nameTh;
        const change = entry.change === null ? t("ยังเทียบเมื่อวานไม่ได้") : t("{arrow} เทียบเมื่อวาน", { arrow: entry.change > 0 ? "↑" : entry.change < 0 ? "↓" : "→" });
        return <Link key={entry.id} href={`/water/dam/${entry.id}`} className="h-[104px] min-w-0 rounded-lg border border-[var(--border)] p-1 text-center text-xs">
          <div data-tank-view={entry.id} role="img" aria-label={summary} className="h-14 text-given" data-scene-state={JSON.stringify({ mode: "svg", ...entry.state })}><GridTankSvg entry={entry} /></div>
          <p className="truncate font-semibold leading-4" title={name}>{name}</p>
          <p className="tabular-nums leading-4"><span aria-label={entry.fill.state === "no-data" ? t("ไม่มีรายงาน") : undefined}>{entry.fill.state === "data" ? `${number.format(entry.fill.value)}%` : "—"}</span>{" "}<span className="text-muted" aria-label={change}>{entry.change === null ? "—" : entry.change > 0 ? "↑" : entry.change < 0 ? "↓" : "→"}</span></p>
        </Link>;
      })}
    </div>
  </section>;
}

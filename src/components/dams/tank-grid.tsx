"use client";

import { useMemo } from "react";
import { VisualTransition } from "@/components/visual-transition";
import Link from "next/link";
import { useLite } from "@/hooks/use-lite";
import { useT } from "@/i18n/client";
import { SourceTime } from "@/components/ui/source-time";
import type { Dam } from "@/lib/dams/types";
import type { DamTrend } from "@/lib/dams/trend";
import { visualSummaryTank } from "@/lib/visuals";
import { tankGridData } from "./tank-grid-data";
import { GridTankSvg } from "./tank-svg";

export function TankGrid({ dams, date, trend }: { dams: readonly Dam[]; date: string | null; trend: DamTrend | null }) {
  const t = useT();
  const { reducedMotion } = useLite();
  const entries = useMemo(() => tankGridData(dams, date, trend), [dams, date, trend]);
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  return <section className="placeholder-card space-y-2" aria-label={t("เขื่อนทั้งหมด")}>
    <h2 className="text-lg font-semibold">{t("เขื่อนทั้งหมด")}</h2>
    <p className="text-muted text-xs">{t("เส้นประ = เต็มความจุ 100% · ลูกศร = ไหลเข้า/ระบาย")}</p>
    <SourceTime source="กรมชลประทาน" date={date} kind="daily" />
    <div className="grid grid-cols-4 gap-1 min-[360px]:grid-cols-5 lg:grid-cols-7" style={{ touchAction: "pan-y" }}>
      {entries.map((entry) => {
        const summary = visualSummaryTank(entry.fill, t);
        const name = t.locale === "en" ? entry.nameEn : entry.nameTh;
        const change = entry.change === null ? t("ยังเทียบเมื่อวานไม่ได้") : t("{arrow} เทียบเมื่อวาน", { arrow: entry.change > 0 ? "↑" : entry.change < 0 ? "↓" : "→" });
        return <Link key={entry.id} href={`/water/dam/${entry.id}`} className="h-[104px] min-w-0 rounded-lg border border-[var(--border)] p-1 text-center text-xs">
          <VisualTransition name={`dam-${entry.id}`}><div data-tank-view={entry.id} role="img" aria-label={summary} className="h-14 text-given" data-scene-state={JSON.stringify({ mode: "svg", ...entry.state })}><GridTankSvg entry={entry} reducedMotion={reducedMotion} /></div></VisualTransition>
          <p className="truncate font-semibold leading-4" title={name}>{name}</p>
          <p className="tabular-nums leading-4"><span aria-label={entry.fill.state === "no-data" ? t("ไม่มีรายงาน") : undefined}>{entry.fill.state === "data" ? `${number.format(entry.fill.value)}%` : "—"}</span>{" "}<span className="text-muted" aria-label={change}>{entry.change === null ? "—" : entry.change > 0 ? "↑" : entry.change < 0 ? "↓" : "→"}</span></p>
        </Link>;
      })}
    </div>
  </section>;
}

"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { useLite } from "@/hooks/use-lite";
import { useT } from "@/i18n/client";
import { TimeScrubber } from "@/components/time-scrubber";
import { SourceTime } from "@/components/ui/source-time";
import type { Dam3D } from "@/components/water/dam-3d";
import { damGhosts, damStreams, reportedDamDays } from "@/lib/dams/model3d";
import type { DamHistory } from "@/lib/dams/history";
import type { DamTrend } from "@/lib/dams/trend";
import type { Dam } from "@/lib/dams/types";
import type { GlTier } from "@/lib/three/gl-tier";
import { writeSceneState } from "@/lib/three/scene-state";
import { tankFill, visualSummaryTank } from "@/lib/visuals";
import { sourceTimeMs } from "@/lib/freshness";

type Props = { dam: Dam; trend?: DamTrend | null; history?: DamHistory | null };

export function DamTank({ dam, history, summary }: Props & { summary: string }) {
  const fill = tankFill(dam.storagePct, 121);
  const ghosts = damGhosts(dam, history);
  const y = (pct: number) => 250 - Math.min(121, pct) * 1.6;
  return <svg viewBox="0 0 480 320" className="aspect-[3/2] w-full rounded-xl text-given" role="img" aria-label={summary}>
    <path d="M100 48V250H330V48" fill="none" stroke="currentColor" strokeWidth="3" />
    {fill.state === "data" && <rect x="102" y={y(fill.shown)} width="226" height={fill.height * 160} fill={fill.color} opacity="0.75" />}
    <line x1="90" x2="340" y1={y(100)} y2={y(100)} stroke="currentColor" strokeDasharray="4 3" />
    <text x="348" y={y(100) + 4} fontSize="12" fill="currentColor">100%</text>
    {ghosts.map(({ key, pct }) => <line key={key} data-level={key} x1="100" x2="330" y1={y(pct)} y2={y(pct)}
      stroke={key === "lastYear" ? "#64748b" : "#e11d48"} strokeWidth="2" strokeDasharray={key === "lastYear" ? "6 4" : "2 4"} />)}
  </svg>;
}

export function DamHero({ dam, trend, history }: Props) {
  const t = useT();
  const { lite, reducedMotion } = useLite();
  const [Scene, setScene] = useState<ComponentType<React.ComponentProps<typeof Dam3D>> | null>(null);
  const [tier, setTier] = useState<GlTier>("svg");
  const [failed, setFailed] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [terrain, setTerrain] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const days = reportedDamDays(dam, trend);
  const found = days.findIndex((entry) => entry.date === (day ?? dam.date));
  const index = found < 0 ? days.length - 1 : found;
  const selected = days[index];
  const ghosts = damGhosts(selected, history);
  const showScene = !lite && !reducedMotion && !failed && Scene !== null;
  const mode = showScene ? tier : "svg";
  const dateFormat = new Intl.DateTimeFormat(t.intl, { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
  const dateLabel = (date: string) => {
    const at = sourceTimeMs(date);
    return at === null ? t("ไม่ทราบวันที่ข้อมูล") : dateFormat.format(new Date(at));
  };
  const selectedDate = dateLabel(selected.date);
  const summary = `${visualSummaryTank(tankFill(selected.storagePct, 121), t)} · ${t("ข้อมูลวันที่ {date}", { date: selectedDate })}`;

  useEffect(() => {
    if (lite || reducedMotion || failed) return;
    let active = true;
    void import("@/components/water/dam-3d").then((module) => {
      if (active) setScene(() => module.Dam3D);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [lite, reducedMotion, failed]);

  useEffect(() => {
    if (host.current) writeSceneState(host.current, { mode, day: selected.date, pct: selected.storagePct,
      ghosts, particles: mode === "full" ? damStreams(selected) : { release: 0, inflow: 0 } });
  }, [mode, selected, ghosts]);

  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  return <div ref={host} className="space-y-2" data-scene-state={JSON.stringify({ mode, day: selected.date,
    pct: selected.storagePct, ghosts, particles: mode === "full" ? damStreams(selected) : { release: 0, inflow: 0 } })}>
    {showScene ? <Scene dam={selected} history={history} theme="light" reducedMotion={reducedMotion}
      detail summary={summary} onTierChange={setTier} onTerrainLoaded={() => setTerrain(true)}
      onFallback={() => { setFailed(true); setTier("svg"); }} /> : <DamTank dam={selected} history={history} summary={summary} />}
    {ghosts.length > 0 && <ul className="flex flex-wrap gap-3 text-xs">{ghosts.map(({ key, pct, date }) => <li key={key}
      style={{ color: key === "lastYear" ? "#64748b" : "#e11d48" }}>{t(key === "lastYear" ? "ปีที่แล้ว {pct}%" : "ปี 2554 {pct}%", { pct: number.format(pct) })} · {dateLabel(date)}</li>)}</ul>}
    {mode !== "svg" && terrain && <p className="text-muted text-xs">{t("ภูมิประเทศขยายความสูง ×{n}", { n: 4 })} · AWS / Mapzen</p>}
    <TimeScrubber days={days.map((entry) => entry.date)} day={selected.date} onChange={setDay}
      label={t("การระบาย ไหลเข้า และปริมาณน้ำในเขื่อน 7 วัน")} reducedMotion={reducedMotion} />
    <p className="text-muted text-xs">{summary}</p>
    <div className="flex flex-wrap gap-3 text-xs"><span>{t("ระบาย (ลบ.ม./วินาที)")}: {selected.releaseCms == null ? "—" : number.format(selected.releaseCms)}</span>
      <span>{t("ไหลเข้า (ลบ.ม./วินาที)")}: {selected.inflowCms == null ? "—" : number.format(selected.inflowCms)}</span></div>
    {selected.date === dam.date ? <SourceTime source="กรมชลประทาน" date={selected.date} kind="daily" />
      : <span className="text-muted text-xs">{t("กรมชลประทาน")} · {t("ข้อมูลวันที่ {date}", { date: selectedDate })}</span>}
  </div>;
}

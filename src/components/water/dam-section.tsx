"use client";

import { useT } from "@/i18n/client";
import { damSceneSummary } from "@/lib/chart-summaries";
import type { DamHistory } from "@/lib/dams/history";
import { damSceneColors, waterLevel } from "@/lib/dams/model3d";
import type { Dam } from "@/lib/dams/types";

export function DamSection({ dam, history, theme }: {
  dam: Dam; history?: DamHistory | null; theme: "light" | "dark";
}) {
  const t = useT();
  const colors = damSceneColors(theme, dam.band);
  const summary = damSceneSummary(dam, history, t);
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  const level = waterLevel(dam.storagePct);
  const y = (height: number) => 220 - height * 150;
  const x = (height: number) => 220 - height * 160;
  const comparisons = history?.dataDate === dam.date ? [
    { key: "last-year", pct: history.lastYear?.pct[dam.id], color: colors.rimLastYear, dash: "6 4" },
    { key: "2554", pct: history.year2554?.pct[dam.id], color: colors.rim2554, dash: "2 4" },
  ].filter((entry): entry is typeof entry & { pct: number } => entry.pct !== undefined && Number.isFinite(entry.pct)) : [];
  const releaseWidth = (dam.releaseCms ?? 0) < 100 ? 3 : (dam.releaseCms ?? 0) < 500 ? 6 : 9;

  return <div className="space-y-2">
    <svg className="w-full text-given" viewBox="0 0 480 320" role="img" aria-label={summary}>
      <rect width="480" height="320" rx="12" fill={colors.background} />
      <text x="20" y="28" fontSize="12" fill="currentColor">{t("แผนภาพ ไม่ใช่ระดับน้ำจริง")}</text>
      <path d="M 20 55 L 44 55 L 220 220 L 330 220 L 370 235 L 460 235 L 460 250 L 20 250 Z" fill={colors.terrain} />
      <path d={`M ${x(level)} ${y(level)} H 330 V 220 H 220 Z`} fill={colors.water} />
      <line x1={x(level)} x2="330" y1={y(level)} y2={y(level)} stroke={colors.waterDeep} strokeWidth="3" />
      <path d="M 330 70 H 346 L 364 235 H 330 Z" fill={colors.wall} />
      {comparisons.map(({ key, pct, color, dash }) => <line key={key} data-level={key}
        x1={x(waterLevel(pct))} x2="330" y1={y(waterLevel(pct))} y2={y(waterLevel(pct))}
        stroke={color} strokeWidth="2" strokeDasharray={dash} />)}
      {dam.releaseCms !== null && dam.releaseCms > 0 && <g data-release="arrow" fill={colors.waterDeep}>
        <path d="M 347 205 Q 377 205 389 225 H 439" fill="none" stroke={colors.waterDeep} strokeWidth={releaseWidth} strokeLinecap="round" />
        <path d={`M 452 225 L 437 ${225 - releaseWidth - 3} V ${225 + releaseWidth + 3} Z`} />
      </g>}
      <text x="20" y="271" fontSize="12" fill="currentColor">{t("ปริมาณน้ำในเขื่อน")}: {number.format(dam.storagePct)}%</text>
      {comparisons.map(({ key, pct, color, dash }, index) => <g key={key}>
        <line x1="20" x2="44" y1={291 + index * 18} y2={291 + index * 18} stroke={color} strokeWidth="2" strokeDasharray={dash} />
        <text x="52" y={295 + index * 18} fontSize="12" fill="currentColor">{t(key === "last-year" ? "ปีที่แล้ว {pct}%" : "ปี 2554 {pct}%", { pct: number.format(pct) })}</text>
      </g>)}
    </svg>
    <p className="text-muted text-xs">{summary}</p>
  </div>;
}

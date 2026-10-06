"use client";

import { useT } from "@/i18n/client";
import { SourceTime } from "@/components/ui/source-time";
import type { DamTrend } from "@/lib/dams/trend";
import type { Dam } from "@/lib/dams/types";
import { previousDate } from "@/lib/dams/pillar";

export function capacityColor(pct: number | null | undefined) {
  return pct == null ? "var(--nodata)" : pct > 100 ? "var(--warn)" : pct > 80 ? "var(--release)" : "var(--water)";
}

export function DamHero({ dam, trend }: { dam: Dam; trend?: DamTrend | null }) {
  const t = useT();
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  const value = (n: number | null | undefined) => n == null ? t("ไม่รายงาน") : number.format(n);
  const yesterday = previousDate(dam.date);
  const index = trend?.dates.indexOf(yesterday) ?? -1;
  const prior = index < 0 ? null : trend?.release[dam.id]?.[index] ?? null;
  const delta = dam.releaseCms == null || prior == null ? null : dam.releaseCms - prior;
  const circumference = 2 * Math.PI * 52;
  return <div>
    <div className="dam-hero">
      <div className="dam-gauge">
        <svg viewBox="0 0 130 130" role="img" aria-label={t("{pct}% ของความจุ", { pct: value(dam.storagePct) })}>
          <circle cx="65" cy="65" r="52" fill="none" stroke="var(--border)" strokeWidth="14" />
          <circle cx="65" cy="65" r="52" fill="none" stroke={capacityColor(dam.storagePct)} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${circumference * Math.max(0, Math.min(dam.storagePct, 100)) / 100} ${circumference}`} transform="rotate(-90 65 65)" />
          {dam.storagePct > 100 && <circle data-overflow="true" cx="65" cy="65" r="62" fill="none" stroke="var(--warn)" strokeWidth="3" strokeDasharray={`${2 * Math.PI * 62 * Math.min(100, dam.storagePct - 100) / 100} ${2 * Math.PI * 62}`} transform="rotate(-90 65 65)" />}
          <text x="65" y="63" textAnchor="middle" fontSize="26" fontWeight="700" fill="currentColor">{value(dam.storagePct)}%</text>
          <text x="65" y="83" textAnchor="middle" fontSize="11" fill="var(--muted)">{t("ของความจุ")}</text>
        </svg>
      </div>
      <div className="dam-release">
        <span className="text-muted text-xs">{t("ระบาย")}</span>
        <strong>{value(dam.releaseCms)}</strong><span className="text-muted text-xs">{t("ลบ.ม./วินาที")}</span>
        <span className="text-xs">{delta == null ? t("ไม่พบข้อมูลเทียบเมื่อวาน") : `${delta > 0 ? "▲" : delta < 0 ? "▼" : "＝"} ${value(Math.abs(delta))} ${t("เทียบเมื่อวาน")}`}</span>
      </div>
    </div>
    <div className="dam-metrics">
      <div>{t("ไหลเข้า (ลบ.ม./วินาที)")}<b>{value(dam.inflowCms)}</b></div>
      <div>{t("เก็บกัก / ความจุ (ล้าน ม³)")}<b>{value(dam.storageMcm)} / {value(dam.capacityMcm)}</b></div>
    </div>
    <SourceTime source="กรมชลประทาน" date={dam.date} kind="daily" />
  </div>;
}

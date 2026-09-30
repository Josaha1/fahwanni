"use client";

import Link from "next/link";
import { useT } from "@/i18n/client";
import { damBandColor, damBandWord } from "@/lib/dams/bands";
import type { Dam } from "@/lib/dams/types";
import { formatFullDate } from "@/lib/format";
import { Dam3DDialog } from "./dam-3d-dialog";

export function damDetailsId(id: string) { return `dam-details-${id}`; }

export function damRowPercentLabel(pct: number, locale: "th" | "en") {
  return `${new Intl.NumberFormat(locale === "en" ? "en-GB" : "th-TH", { maximumFractionDigits: 1 }).format(pct)}%`;
}

export function DamRowHeader({ dam, dataDate, km, expanded, onToggle, detailsId, showDate = true }: {
  dam: Dam; dataDate?: string; km?: number; expanded: boolean; onToggle: () => void; detailsId?: string; showDate?: boolean;
}) {
  const t = useT();
  const name = t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh;
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 0 });
  const flow = (value: number | null) => value === null ? "—" : t("{value} ลบ.ม./วินาที", { value: number.format(value) });
  return <div className="text-sm">
    <button type="button" className="flex min-h-11 w-full min-w-0 items-center gap-2 text-left" onClick={onToggle}
      aria-expanded={expanded} aria-controls={detailsId ?? damDetailsId(dam.id)}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: damBandColor(dam.band) }} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{name}</span>
        {dataDate && dam.date !== dataDate && <span className="block text-muted text-xs">{t("ข้อมูล {date}", {
          date: new Intl.DateTimeFormat(t.intl, { day: "numeric", month: "short", timeZone: "Asia/Bangkok" })
            .format(new Date(`${dam.date}T12:00:00+07:00`)),
        })}</span>}
      </span>
      {km !== undefined && <span className="shrink-0 text-muted text-xs">{t("{km} กม.", { km: number.format(km) })}</span>}
      <span className="shrink-0 tabular-nums font-semibold">{damRowPercentLabel(dam.storagePct, t.locale)}</span>
      <span className="sr-only">{t(damBandWord(dam.band))}</span>
      <span className="shrink-0" aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
      <span className="sr-only">{t(expanded ? "ย่อรายละเอียด" : "ขยายรายละเอียด")}</span>
    </button>
    <div id={detailsId ?? damDetailsId(dam.id)} hidden={!expanded} className="space-y-1 pb-2">
      <p>{t("น้ำไหลผ่านเขื่อน (ระบาย)")}: {flow(dam.releaseCms)}</p>
      <p>{t("น้ำไหลเข้า")}: {flow(dam.inflowCms)}</p>
      {showDate && <p className="text-muted text-xs">{t("ข้อมูลวันที่ {date}", { date: formatFullDate(`${dam.date}T12:00:00+07:00`, "Asia/Bangkok", t.locale) })}</p>}
      <Dam3DDialog dam={dam} className="inline-flex min-h-11 items-center font-semibold text-given underline underline-offset-2 mr-3" />
      <Link className="inline-flex min-h-11 items-center font-semibold text-given underline underline-offset-2"
        href={`/map?mode=water&dam=${encodeURIComponent(dam.id)}`}>{t("ดูบนแผนที่")}</Link>
    </div>
  </div>;
}

"use client";

import Link from "next/link";
import { useT } from "@/i18n/client";
import { SourceTime } from "@/components/ui/source-time";
import { provinces } from "@/lib/provinces";
import { DAM_REGISTRY } from "@/lib/dams/registry";
import type { FollowChange } from "@/lib/water/whats-new";

export function FollowedChanges({ changes }: { changes: FollowChange[] }) {
  const t = useT();
  if (!changes.length) return null;
  const number = (value: number) => new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 }).format(value);
  return <section aria-labelledby="followed-changes-title"><h2 id="followed-changes-title">{t("เปลี่ยนตั้งแต่ครั้งก่อน")}</h2>
    <ol className="alerts-rows">{changes.map((entry) => {
      const [kind, id] = entry.key.split(":");
      const dam = DAM_REGISTRY.find((item) => item.id === id);
      const province = provinces.find((item) => item.id === id);
      const name = kind === "dam" ? t.locale === "en" ? dam?.nameEn : dam?.nameTh : t.locale === "en" ? province?.en : province?.th;
      const label = t(entry.kind === "release" ? "ระบาย" : entry.kind === "pct" ? "ปริมาณน้ำในเขื่อน (%)" : entry.kind === "water" ? "ดาวเทียมพบน้ำ" : "ประกาศเตือนใหม่");
      const unit = entry.kind === "release" ? t("ลบ.ม./วิ") : entry.kind === "pct" ? "%" : entry.kind === "water" ? t("จุด") : t("ประกาศ");
      return <li key={`${entry.key}:${entry.kind}:${entry.warningId ?? ""}`}><Link href={`/${kind}/${id}`}>
        <i aria-hidden="true" style={{ background: `var(--${entry.kind === "warning" ? "warn" : entry.kind === "water" ? "water" : "release"})` }} />
        <span className="alerts-text"><span>{name ?? id} · {label}{entry.kind === "release" ? " ▲" : ""} · {number(entry.from)} → {number(entry.to)} {unit}{entry.title && ` · ${entry.title}`}</span>
          <SourceTime source={entry.source} date={entry.date} kind={entry.kind === "water" ? "satellite" : "daily"} />
        </span></Link></li>;
    })}</ol>
  </section>;
}

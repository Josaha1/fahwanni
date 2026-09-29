"use client";

import { useT } from "@/i18n/client";
import { formatTime } from "@/lib/format";
import { warningKey, type TmdWarning } from "@/lib/tmd";

export function TmdWarningList({ items, limit, onDismiss, onMap = false }: { items: TmdWarning[]; limit: number; onDismiss?: (key: string) => void; onMap?: boolean }) {
  const t = useT();
  return <section className="space-y-2" aria-label={t("ประกาศเตือนภัยกรมอุตุฯ")}>
    {items.slice(0, limit).map((item) => {
      const announcedAt = item.announcedAt?.replace(/^([0-9]{4}-[0-9]{2}-[0-9]{2}) ([0-9]{2}:[0-9]{2}:[0-9]{2})$/, "$1T$2+07:00");
      const time = announcedAt && !Number.isNaN(Date.parse(announcedAt)) ? formatTime(announcedAt, "Asia/Bangkok", t.locale) : null;
      return <article key={warningKey(item)} className="rounded-lg border p-3" style={{ borderColor: onMap ? "var(--map-panel-border)" : "var(--border)" }}>
        <div className="flex items-start gap-2">
          <span className="map-warning" aria-hidden="true">⚠</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{item.title}</p>
            {time && <p className={`${onMap ? "map-muted" : "text-muted"} text-xs`}>{t("ประกาศเมื่อ {time} น.", { time })}</p>}
          </div>
          {onDismiss && <button type="button" className="map-icon-btn shrink-0" aria-label={t("ปิดประกาศ {title}", { title: item.title })} onClick={() => onDismiss(warningKey(item))}>✕</button>}
        </div>
        <details className="mt-1">
          <summary className="cursor-pointer font-semibold">{t("ดูเพิ่มเติม")}</summary>
          <p className="mt-1 whitespace-pre-line">{item.description}</p>
          {item.url && /^https:\/\//i.test(item.url) && <a className="mt-1 inline-block underline" href={item.url} target="_blank" rel="noopener noreferrer">{t("อ่านประกาศ")}</a>}
        </details>
      </article>;
    })}
    {items.length > limit && <p className={`${onMap ? "map-muted" : "text-muted"} text-xs`}>{t("+{n} ประกาศ", { n: items.length - limit })}</p>}
  </section>;
}

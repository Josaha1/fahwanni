import type { T } from "@/i18n/core";
import type { SummaryCard } from "./summary-card";

export function EmbedCard({ card, t }: { card: SummaryCard; t: T }) {
  return <main className="mx-auto grid max-w-lg gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 text-[var(--foreground)]">
    <h1 className="text-lg font-semibold">{card.title}</h1>
    <dl className="grid gap-3">{card.metrics.map((metric) => <div key={metric.label}>
      <dt className="text-xs text-muted">{metric.label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{metric.value}</dd>
      <dd className="text-xs text-muted">{t("ที่มา")}: {metric.source} · <time>{metric.date}</time></dd>
    </div>)}</dl>
    {card.notes.map((note) => <p className="text-xs text-muted" key={note}>{note}</p>)}
    <a className="text-sm underline" href={card.path} target="_blank" rel="noopener noreferrer">{t("ดูหน้าเต็ม")} · {t("ฟ้าวันนี้")}</a>
  </main>;
}

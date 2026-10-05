"use client";

import { useLastPlace } from "@/hooks/use-favourites";
import { useWaterSource } from "@/hooks/use-water-source";
import { useT } from "@/i18n/client";
import { EMERGENCY_NUMBERS } from "@/lib/emergency";
import { SourceTime } from "@/components/ui/source-time";
import type { TmdWarnings } from "@/lib/tmd";
import { MenuTip } from "@/components/menu-tip";
import { OfflineSupport } from "@/components/offline-support";
import { FloodEventList, type FloodEventsPayload } from "@/components/water/flood-events";
import { TmdWarningList } from "@/components/water/tmd-warnings";

const validWarnings = (value: TmdWarnings & { error?: string }) => Array.isArray(value?.items) && !value.error;
const validEvents = (value: FloodEventsPayload) => Array.isArray(value?.items);

export function FloodHome() {
  const t = useT();
  const { place } = useLastPlace();
  const warnings = useWaterSource("/api/tmd-warnings", validWarnings);
  const events = useWaterSource("/api/flood-events", validEvents);

  return <main className="app-shell space-y-4" style={{ paddingBottom: "calc(var(--nav-h, 88px) + 2rem)" }}>
    <header>
      <h1 id="flood-home-title" tabIndex={-1} className="text-2xl font-semibold">{t("ฟ้าวันนี้ · น้ำท่วม")}</h1>
      <p className="text-muted">{t.locale === "en" ? place.admin ?? place.name : place.name}</p>
    </header>
    <MenuTip onClose={() => document.getElementById("flood-home-title")?.focus()} />
    <OfflineSupport />
    <section className="placeholder-card space-y-2" aria-label={t("ประกาศเตือนภัยกรมอุตุฯ")}>
      {warnings.data ? warnings.data.items.length > 0 ? <>
        <h2 className="text-lg font-semibold">{t("ประกาศเตือนภัยกรมอุตุฯ")}</h2>
        <TmdWarningList items={warnings.data.items} limit={3} />
      </> : <p className="text-muted text-sm">{t("ไม่มีประกาศเตือนภัย")} · <SourceTime source="TMD" time={warnings.loadedAt} kind="daily" /></p> : <p className="text-muted text-sm" role="status">{t(warnings.status === "loading" ? "กำลังโหลดประกาศเตือนภัย…" : "ข้อมูลประกาศเตือนภัยไม่พร้อมใช้งาน")}</p>}
    </section>
    <section className="placeholder-card space-y-2" aria-label={t("เหตุการณ์น้ำท่วม/ภัยพิบัติ")}>
      <h2 className="text-lg font-semibold">{t("เหตุการณ์น้ำท่วม/ภัยพิบัติ")}</h2>
      {events.data ? <FloodEventList payload={events.data} />
        : <p className="text-muted text-sm" role="status">{t(events.status === "loading" ? "กำลังโหลดเหตุการณ์น้ำท่วม…" : "ข้อมูลเหตุการณ์น้ำท่วมไม่พร้อมใช้งาน")}</p>}
    </section>
    <footer className="space-y-2 border-t border-[var(--border)] pt-4 text-sm" aria-label={t("เบอร์ฉุกเฉิน")}>
      <h2 className="text-lg font-semibold">{t("เบอร์ฉุกเฉิน")}</h2>
      <div className="flex flex-wrap gap-3">{EMERGENCY_NUMBERS.map(({ label, number, href }) => <a key={number} className="inline-flex min-h-11 items-center font-semibold text-given underline" href={href}>{t(label)}</a>)}</div>
    </footer>
  </main>;
}

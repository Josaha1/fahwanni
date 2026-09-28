import { useT } from "@/i18n/client";
import { formatFullDate, formatTime } from "@/lib/format";
import type { WeatherAlert } from "@/lib/weather/types";

function severityLabel(severity: string | undefined, t: ReturnType<typeof useT>): string | undefined {
  switch (severity) {
    case "EXTREME": return t("รุนแรงมาก");
    case "SEVERE": return t("รุนแรง");
    case "MODERATE": return t("ปานกลาง");
    case "MINOR": return t("เล็กน้อย");
    default: return undefined;
  }
}

export function AlertsCard({ alerts, timeZone }: { alerts: WeatherAlert[]; timeZone?: string }) {
  const t = useT();
  if (alerts.length === 0) return null;
  const zone = timeZone ?? "UTC";
  const when = (iso: string) => `${formatFullDate(iso, zone, t.locale)} ${formatTime(iso, zone, t.locale)}`;

  return (
    <section aria-label={t("ประกาศเตือนภัย")} className="space-y-3">
      <h2 className="text-xl">{t("ประกาศเตือนภัย")}</h2>
      {alerts.map((alert, index) => (
        <article key={alert.id ?? index} className="placeholder-card border-zone-alert-ink">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-lg font-semibold">{alert.title ?? t("ประกาศเตือนภัย")}</h3>
            {severityLabel(alert.severity, t) && <span className="rounded-full bg-zone-alert px-3 py-1 text-sm font-semibold text-zone-alert-ink">{severityLabel(alert.severity, t)}</span>}
          </div>
          {alert.areaName && <p className="mt-2 text-sm">{t("พื้นที่")} · {alert.areaName}</p>}
          {(alert.startTime || alert.expirationTime) && <p className="mt-2 text-sm text-muted">
            {alert.startTime && `${t("เริ่ม")} ${when(alert.startTime)}`}
            {alert.startTime && alert.expirationTime && " · "}
            {alert.expirationTime && `${t("สิ้นสุด")} ${when(alert.expirationTime)}`}
          </p>}
          {alert.description && <details className="mt-3">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-given focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given">{t("ดูเพิ่มเติม")}</summary>
            <p className="whitespace-pre-line text-sm">{alert.description}</p>
          </details>}
          {alert.instructions.length > 0 && <div className="mt-3">
            <p className="font-semibold">{t("คำแนะนำจากประกาศ")}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {alert.instructions.map((instruction, instructionIndex) => <li key={instructionIndex}>{instruction}</li>)}
            </ul>
          </div>}
        </article>
      ))}
    </section>
  );
}

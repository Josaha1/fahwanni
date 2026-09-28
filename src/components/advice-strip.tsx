import { useT } from "@/i18n/client";
import { adviceText } from "@/lib/advice-text";
import { advise } from "@/lib/advise";
import type { AirSnapshot } from "@/lib/air";
import type { WeatherSnapshot } from "@/lib/weather/types";

export function AdviceStrip({ snapshot, air }: { snapshot: WeatherSnapshot; air?: AirSnapshot }) {
  const t = useT();
  const items = advise(snapshot, { pm25: air?.pm25 }, new Date().toISOString());
  if (items.length === 0) return null;
  const warnings = items.filter((item) => item.severity === "warn");
  const warning = (item: typeof items[number]) => (
    <p key={item.id} className={`advice-warning ${["storm", "flood"].includes(item.id) ||
      (item.id === "heat" && ["danger", "extreme"].includes(String(item.params?.band))) ||
      (item.id === "pm25" && ["starting-to-affect", "affects-health"].includes(String(item.params?.band)))
      ? "advice-warning-danger" : "advice-warning-soft"}`}>
      {adviceText(item, t)}
    </p>
  );

  return (
    <section aria-label={t("คำแนะนำวันนี้")} className="space-y-3">
      <h2 className="text-xl">{t("คำแนะนำวันนี้")}</h2>
      {warnings.slice(0, 2).map(warning)}
      {warnings.length > 2 && <details>
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-given focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given">
          {t("ดูคำแนะนำทั้งหมด ({n})", { n: warnings.length - 2 })}
        </summary>
        <div className="mt-2 space-y-3">{warnings.slice(2).map(warning)}</div>
      </details>}
      <div className="flex flex-wrap gap-2">
        {items.filter((item) => item.severity === "tip").map((item) => (
          <p key={item.id} className="rounded-2xl border border-border bg-card px-4 py-2 text-sm">{adviceText(item, t)}</p>
        ))}
      </div>
    </section>
  );
}

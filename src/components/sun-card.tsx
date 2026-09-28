import { useT } from "@/i18n/client";
import { formatDayLabel, formatTime } from "@/lib/format";
import { moonPhaseLabel, nextFullMoon } from "@/lib/moon";
import type { WeatherSnapshot } from "@/lib/weather/types";
import { uvWord } from "@/lib/words";

export function SunCard({ snapshot }: { snapshot: WeatherSnapshot }) {
  const t = useT();
  const today = snapshot.days[0];
  if (!today && snapshot.uvIndex === undefined) return null;
  const zone = snapshot.timeZone ?? "UTC";
  const uv = snapshot.uvIndex;

  return (
    <section className="placeholder-card" aria-label={t("พระอาทิตย์ ดวงจันทร์ และ UV")}>
      <h2 className="text-xl">{t("พระอาทิตย์ ดวงจันทร์ และ UV")}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-muted">{t("พระอาทิตย์ขึ้น")}</p><p className="text-xl font-semibold">{today?.sunrise ? formatTime(today.sunrise, zone, t.locale) : "—"}</p></div>
        <div><p className="text-muted">{t("พระอาทิตย์ตก")}</p><p className="text-xl font-semibold">{today?.sunset ? formatTime(today.sunset, zone, t.locale) : "—"}</p></div>
      </div>
      {today?.moonPhase && (() => {
        const phase = moonPhaseLabel(today.moonPhase, t.locale);
        const full = nextFullMoon(snapshot.days.slice(1));
        if (!phase) return null;
        return <div className="mt-4 border-t border-border pt-3 text-sm">
          <p className="text-muted">{t("ดวงจันทร์คืนนี้")}</p>
          <p className="font-semibold">{phase}
            {today.moonrise && <span className="font-normal"> · {t("ขึ้น {time} น.", { time: formatTime(today.moonrise, zone, t.locale) })}</span>}
          </p>
          {today.moonPhase !== "FULL_MOON" && full && snapshot.fetchedAt && (
            <p className="text-muted">{t("จันทร์เต็มดวง {day}", { day: formatDayLabel(full, snapshot.fetchedAt, zone, t.locale) })}</p>
          )}
        </div>;
      })()}
      {uv !== undefined && <div className="mt-4 border-t border-border pt-3">
        <p className="text-sm text-muted">{t("ดัชนี UV")}</p>
        <p><strong className="text-2xl">{Math.round(uv)}</strong> · {uvWord(uv, t)}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky" role="meter" aria-label={t("ดัชนี UV")} aria-valuemin={0} aria-valuemax={11} aria-valuenow={Math.min(11, Math.max(0, uv))} aria-valuetext={`${Math.round(uv)} · ${uvWord(uv, t)}`}>
          <div className="h-full rounded-full bg-given" style={{ width: `${Math.min(100, Math.max(0, uv) / 11 * 100)}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted"><span>0</span><span>11+</span></div>
      </div>}
    </section>
  );
}

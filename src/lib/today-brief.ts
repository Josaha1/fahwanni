import { TZDate } from "@date-fns/tz";
import type { T } from "@/i18n/core";
import { heatBand } from "./advise";
import { statusWord } from "./rivers/status";
import type { RiverStatus } from "./rivers/types";
import type { WeatherHour, WeatherSnapshot } from "./weather/types";
import { heatBandWord } from "./words";

type Brief = { rain?: string; heat?: string; water?: string };
type RainWindow = { start: number; end: number; chance: number };

function rainWindows(hours: WeatherHour[], timeZone: string, nowIso: string): RainWindow[] {
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) return [];
  const today = new TZDate(nowIso, timeZone).toDateString();
  const usable = hours.flatMap((hour) => {
    const start = Date.parse(hour.startTime ?? "");
    const end = hour.endTime ? Date.parse(hour.endTime) : start + 3_600_000;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= now ||
      new TZDate(start, timeZone).toDateString() !== today ||
      !Number.isFinite(hour.rainChance) || hour.rainChance! < 0 || hour.rainChance! > 100) return [];
    return [{ start, end, chance: hour.rainChance! }];
  }).sort((a, b) => a.start - b.start);
  const pairs = usable.flatMap((hour, index) => {
    const next = usable[index + 1];
    return next && hour.end === next.start && new TZDate(next.start, timeZone).toDateString() === today
      ? [{ start: hour.start, end: next.end, chance: (hour.chance + next.chance) / 2 }] : [];
  });
  return pairs.length ? pairs : usable;
}

/** Selects only available, remaining local-day facts from the already loaded home data. */
export function todayBrief(snapshot: WeatherSnapshot | undefined, riverStatus: RiverStatus | null, nowIso: string, t: T): Brief {
  const result: Brief = {};
  if (snapshot) {
    const timeZone = snapshot.timeZone ?? "UTC";
    const windows = rainWindows(snapshot.hours, timeZone, nowIso);
    if (windows.length) {
      const best = windows.reduce((chosen, current) => current.chance < chosen.chance ? current : chosen);
      const worst = windows.reduce((chosen, current) => current.chance > chosen.chance ? current : chosen);
      const label = (window: RainWindow) => {
        const start = new TZDate(window.start, timeZone).getHours();
        const end = new TZDate(window.end, timeZone).getHours();
        return `${start}–${end}`;
      };
      result.rain = best === worst || best.chance === worst.chance
        ? t("ฝน: {time} น. โอกาส {chance}%", { time: label(best), chance: Math.round(best.chance) })
        : t("ฝน: น้อยสุด {best} · มากสุด {worst} น.", { best: label(best), worst: label(worst) });
    }
    if (snapshot.heatIndexC !== undefined && Number.isFinite(snapshot.heatIndexC)) {
      result.heat = t("ดัชนีความร้อน {temp}° · {band}", {
        temp: Math.round(snapshot.heatIndexC), band: heatBandWord(heatBand(snapshot.heatIndexC), t),
      });
    }
  }
  if (riverStatus) result.water = t("น้ำใกล้คุณ: {status} (แบบจำลอง)", { status: t(statusWord(riverStatus)) });
  return result;
}

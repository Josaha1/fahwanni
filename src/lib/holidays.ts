/**
 * Thai national government holidays (days most offices and schools close), YYYY-MM-DD.
 * 2569/2026: Thai PBS + kapook calendar, cross-checked 2026-09-28 (soc.go.th blocks fetching).
 * 2570/2027: kapook calendar — PROVISIONAL, not yet stated as cabinet-approved; re-check when
 * the cabinet announces. Bank-only days, staff-only days (Royal Ploughing) and regional special
 * days (e.g. 28–29 Sep 2026 in 4 Bangkok-area provinces) are intentionally left out.
 */
export const THAI_HOLIDAYS: Record<string, string> = {
  "2026-01-01": "วันขึ้นปีใหม่",
  "2026-01-02": "วันหยุดพิเศษ",
  "2026-03-03": "วันมาฆบูชา",
  "2026-04-06": "วันจักรี",
  "2026-04-13": "วันสงกรานต์",
  "2026-04-14": "วันสงกรานต์",
  "2026-04-15": "วันสงกรานต์",
  "2026-05-01": "วันแรงงานแห่งชาติ",
  "2026-05-04": "วันฉัตรมงคล",
  "2026-05-31": "วันวิสาขบูชา",
  "2026-06-01": "ชดเชยวันวิสาขบูชา",
  "2026-06-03": "วันเฉลิมพระชนมพรรษาพระราชินี",
  "2026-07-28": "วันเฉลิมพระชนมพรรษา",
  "2026-07-29": "วันอาสาฬหบูชา",
  "2026-07-30": "วันเข้าพรรษา",
  "2026-08-12": "วันแม่แห่งชาติ",
  "2026-10-13": "วันนวมินทรมหาราช",
  "2026-10-23": "วันปิยมหาราช",
  "2026-12-05": "วันพ่อแห่งชาติ",
  "2026-12-07": "ชดเชยวันพ่อแห่งชาติ",
  "2026-12-10": "วันรัฐธรรมนูญ",
  "2026-12-31": "วันสิ้นปี",
  // 2027 — provisional (see note above)
  "2027-01-01": "วันขึ้นปีใหม่",
  "2027-02-21": "วันมาฆบูชา",
  "2027-02-22": "ชดเชยวันมาฆบูชา",
  "2027-04-06": "วันจักรี",
  "2027-04-13": "วันสงกรานต์",
  "2027-04-14": "วันสงกรานต์",
  "2027-04-15": "วันสงกรานต์",
  "2027-05-20": "วันวิสาขบูชา",
  "2027-06-03": "วันเฉลิมพระชนมพรรษาพระราชินี",
  "2027-07-18": "วันอาสาฬหบูชา",
  "2027-07-19": "วันเข้าพรรษา",
  "2027-07-28": "วันเฉลิมพระชนมพรรษา",
  "2027-08-12": "วันแม่แห่งชาติ",
  "2027-10-13": "วันนวมินทรมหาราช",
  "2027-10-23": "วันปิยมหาราช",
  "2027-10-25": "ชดเชยวันปิยมหาราช",
  "2027-12-05": "วันพ่อแห่งชาติ",
  "2027-12-06": "ชดเชยวันพ่อแห่งชาติ",
  "2027-12-10": "วันรัฐธรรมนูญ",
  "2027-12-31": "วันสิ้นปี",
};

export interface LongWeekend {
  start: string;
  end: string;
  days: string[];
  names: string[];
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());

/**
 * Runs of ≥ 3 consecutive days off (weekends + holidays) that contain at least one holiday and
 * overlap [today, today + windowDays). Runs are found in full, so one that began yesterday counts.
 */
export function longWeekends(today: string, windowDays = 10, holidays: Record<string, string> = THAI_HOLIDAYS): LongWeekend[] {
  const off = (d: string) => weekend(d) || d in holidays;
  const results: LongWeekend[] = [];
  let day = today;
  while (off(addDays(day, -1))) day = addDays(day, -1); // rewind into a run already underway
  const last = addDays(today, windowDays - 1);
  while (day <= last) {
    if (!off(day)) { day = addDays(day, 1); continue; }
    const run: string[] = [];
    while (off(day)) { run.push(day); day = addDays(day, 1); }
    const names = [...new Set(run.filter((d) => d in holidays).map((d) => holidays[d]))];
    if (run.length >= 3 && names.length > 0 && run.at(-1)! >= today) {
      results.push({ start: run[0], end: run.at(-1)!, days: run, names });
    }
  }
  return results;
}

export interface RunForecast {
  /** Forecast days found for the run (the 10-day forecast may not reach the end). */
  covered: number;
  rainChanceMax?: number;
  minC?: number;
  maxC?: number;
}

/** Joins a long weekend with the daily forecast (days matched by local date). */
export function forecastForRun(run: LongWeekend, days: { date?: string; minTempC?: number; maxTempC?: number; day: { rainChance?: number }; night: { rainChance?: number } }[]): RunForecast {
  const matched = days.filter((day) => day.date && run.days.includes(day.date));
  if (matched.length === 0) return { covered: 0 };
  const nums = (values: (number | undefined)[]) => values.filter((v): v is number => v !== undefined);
  const rain = nums(matched.flatMap((day) => [day.day.rainChance, day.night.rainChance]));
  const mins = nums(matched.map((day) => day.minTempC));
  const maxs = nums(matched.map((day) => day.maxTempC));
  return {
    covered: matched.length,
    rainChanceMax: rain.length ? Math.round(Math.max(...rain)) : undefined,
    minC: mins.length ? Math.round(Math.min(...mins)) : undefined,
    maxC: maxs.length ? Math.round(Math.max(...maxs)) : undefined,
  };
}

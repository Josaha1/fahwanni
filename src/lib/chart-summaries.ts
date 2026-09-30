import type { T } from "@/i18n/core";

type DatedValue = { date: string; value: number };

export function dayLabel(date: string, t: T) {
  return new Intl.DateTimeFormat(t.locale === "en" ? "en-GB" : "th-TH", {
    weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Bangkok",
  }).format(new Date(`${date}T12:00:00+07:00`));
}

function direction(first: number, last: number, t: T) {
  return t(last > first ? "กำลังเพิ่ม" : last < first ? "กำลังลด" : "คงที่");
}

export function riverChartSummary(days: DatedValue[], t: T): string {
  const shown = days.slice(0, 7);
  const number = new Intl.NumberFormat(t.locale === "en" ? "en-GB" : "th-TH", { maximumFractionDigits: 0 });
  const peak = shown.reduce((highest, day) => day.value > highest.value ? day : highest);
  return t("กราฟน้ำไหลผ่าน 7 วัน: ต่ำสุด {low}–สูงสุด {high} ลบ.ม./วินาที · สูงสุดวันที่ {date} · {trend}", {
    low: number.format(Math.min(...shown.map((day) => day.value))), high: number.format(peak.value),
    date: dayLabel(peak.date, t), trend: direction(shown[0].value, shown.at(-1)!.value, t),
  });
}

export function pointDayChartSummary(hours: { temp: number | null; prob: number | null }[], t: T): string {
  const temps = hours.flatMap((hour) => hour.temp === null ? [] : [hour.temp]);
  const rainy = hours.filter((hour) => (hour.prob ?? 0) >= 50).length;
  if (!temps.length) return t("24 ชม. ข้างหน้า: ไม่มีข้อมูลอุณหภูมิ · ฝนโอกาส 50% ขึ้นไป {n} ชม.", { n: rainy });
  return t("24 ชม. ข้างหน้า: {low}–{high}° · ฝนโอกาส 50% ขึ้นไป {n} ชม.", {
    low: Math.round(Math.min(...temps)), high: Math.round(Math.max(...temps)), n: rainy,
  });
}

export function damSparklineSummary(values: (number | null)[], dates: string[], t: T): string {
  const present = values.flatMap((value) => value === null ? [] : [value]);
  const number = new Intl.NumberFormat(t.locale === "en" ? "en-GB" : "th-TH", { maximumFractionDigits: 1 });
  const peakIndex = values.findIndex((value) => value === Math.max(...present));
  const params = { low: number.format(Math.min(...present)), high: number.format(Math.max(...present)),
    trend: direction(present[0], present.at(-1)!, t) };
  const peakDate = dates[peakIndex];
  return peakDate
    ? t("กราฟน้ำในเขื่อน 7 วัน: ต่ำสุด {low}–สูงสุด {high}% · สูงสุดวันที่ {date} · {trend}", { ...params, date: dayLabel(peakDate, t) })
    : t("กราฟน้ำในเขื่อน 7 วัน: ต่ำสุด {low}–สูงสุด {high}% · {trend}", params);
}

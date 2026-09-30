import { describe, expect, it } from "vitest";
import { translator } from "@/i18n/core";
import { damSparklineSummary, dayLabel, pointDayChartSummary, riverChartSummary } from "./chart-summaries";

describe("chart text alternatives", () => {
  const th = translator("th");
  const en = translator("en");

  it("formats chart dates with a weekday in Bangkok time", () => {
    expect(dayLabel("2026-10-01", th)).toBe("พฤหัส 1 ต.ค.");
    expect(dayLabel("2026-10-01", en)).toBe("Thu 1 Oct");
  });

  it("summarizes the shown river days, peak date, and direction", () => {
    const days = [
      { date: "2026-09-27", value: 120 },
      { date: "2026-09-28", value: 250 },
      { date: "2026-09-29", value: 180 },
    ];
    expect(riverChartSummary(days, th)).toContain("120–สูงสุด 250 ลบ.ม./วินาที");
    expect(riverChartSummary(days, th)).toContain(`สูงสุดวันที่ ${dayLabel("2026-09-28", th)}`);
    expect(riverChartSummary(days, th)).toContain("กำลังเพิ่ม");
    expect(riverChartSummary(days, en)).toContain("Peak on Mon 28 Sept");
  });

  it("summarizes point temperatures and handles missing temperatures", () => {
    expect(pointDayChartSummary([{ temp: 29, prob: 50 }, { temp: 26, prob: null }], th))
      .toContain("26–29° · ฝนโอกาส 50% ขึ้นไป 1 ชม.");
    expect(pointDayChartSummary([{ temp: null, prob: 60 }], en))
      .toContain("temperature unavailable · 1 h");
  });

  it("ignores missing dam values and reports the dated peak and fall", () => {
    const summary = damSparklineSummary([null, 83, 88, 84],
      ["2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"], th);
    expect(summary).toContain("83–สูงสุด 88%");
    expect(summary).toContain(`สูงสุดวันที่ ${dayLabel("2026-09-28", th)}`);
    expect(summary).toContain("กำลังเพิ่ม");
    expect(damSparklineSummary([88, null, 84], ["2026-09-27", "2026-09-28", "2026-09-29"], th))
      .toContain("กำลังลด");
  });

  it("omits the peak date when the dam date is missing", () => {
    expect(damSparklineSummary([83, 88, 84], ["2026-09-27"], th))
      .toBe("กราฟน้ำในเขื่อน 7 วัน: ต่ำสุด 83–สูงสุด 88% · กำลังเพิ่ม");
    expect(damSparklineSummary([83, 88, 84], ["2026-09-27"], en))
      .toBe("7-day reservoir storage: 83–88% · Rising");
  });
});

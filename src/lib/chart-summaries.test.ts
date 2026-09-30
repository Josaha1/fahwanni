import { describe, expect, it } from "vitest";
import { translator } from "@/i18n/core";
import { damSceneSummary, damSparklineSummary, dayLabel, pointDayChartSummary, riverChartSummary } from "./chart-summaries";
import fixture from "./dams/fixture-rid.json";
import type { DamHistory } from "./dams/history";
import { parseRidDams } from "./dams/rid";

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

describe("dam scene text alternative", () => {
  const th = translator("th");
  const en = translator("en");
  const dam = { ...parseRidDams(fixture).dams[0], storagePct: 105.5, band: 5 as const, releaseCms: 1234.5 };
  const history: DamHistory = {
    dataDate: dam.date,
    lastYear: { date: "2025-09-29", pct: { [dam.id]: 75.2 } },
    year2554: { date: "2011-09-29", pct: { [dam.id]: 0 } },
  };

  it("summarizes current storage, band, both historical levels and release in Thai", () => {
    expect(damSceneSummary(dam, history, th)).toBe(
      `${dam.nameTh} กักเก็บ 105.5% · เกินความจุ · ปีที่แล้ว 75.2% · ปี 2554 0% · ระบาย 1,234.5 ลบ.ม./วินาที · แผนภาพ ไม่ใช่ระดับน้ำจริง`,
    );
  });

  it("translates the summary and dam name into English", () => {
    expect(damSceneSummary(dam, history, en)).toBe(
      `${dam.nameEn} storage 105.5% · Above capacity · Last year 75.2% · 2011 0% · Release 1,234.5 m³/s · Schematic, not the actual water level`,
    );
    expect(damSceneSummary({ ...dam, nameEn: "" }, null, en)).toContain(dam.nameTh);
  });

  it.each([null, undefined, { dataDate: dam.date, lastYear: null, year2554: null },
    { ...history, dataDate: "2026-09-28" }])("omits unavailable or stale history: %s", (missing) => {
    expect(damSceneSummary(dam, missing, en)).toBe(
      `${dam.nameEn} storage 105.5% · Above capacity · Release 1,234.5 m³/s · Schematic, not the actual water level`,
    );
  });

  it("omits missing per-dam entries and non-finite historical levels independently", () => {
    const summary = damSceneSummary(dam, { ...history, lastYear: { date: "2025-09-29", pct: {} } }, en);
    expect(summary).not.toContain("Last year");
    expect(summary).toContain("2011 0%");
    const partial = damSceneSummary(dam, { ...history, year2554: { date: "2011-09-29", pct: { [dam.id]: NaN } } }, en);
    expect(partial).toContain("Last year 75.2%");
    expect(partial).not.toContain("2011");
  });

  it("distinguishes a zero release from unavailable release data", () => {
    expect(damSceneSummary({ ...dam, releaseCms: 0 }, null, en)).toContain("Release 0 m³/s");
    expect(damSceneSummary({ ...dam, releaseCms: null }, null, en)).toContain("Release data unavailable");
    expect(damSceneSummary({ ...dam, releaseCms: null }, null, th)).toContain("ไม่มีข้อมูลการระบาย");
  });
});

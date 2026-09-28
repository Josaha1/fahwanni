import { describe, expect, it } from "vitest";
import { formatDayLabel, formatFullDate, formatHour, formatTime, minutesAgo } from "./format";

describe("weather date formatting", () => {
  const timeZone = "Asia/Bangkok";

  it("uses the requested time zone for hour and sunrise labels", () => {
    for (const locale of ["th", "en"] as const) {
      expect(formatHour("2026-09-28T08:05:00Z", timeZone, locale)).toBe("15:05");
      expect(formatTime("2026-09-28T23:02:00Z", timeZone, locale)).toBe("06:02");
      expect(formatHour("2026-09-28T08:05:00Z", "UTC", locale)).toBe("08:05");
    }
  });

  it("compares day labels in the forecast time zone, including a UTC date crossing", () => {
    const now = "2026-09-28T17:30:00Z"; // 00:30 on 29 September in Bangkok
    expect(formatDayLabel("2026-09-29", now, timeZone, "th")).toBe("วันนี้");
    expect(formatDayLabel("2026-09-30", now, timeZone, "th")).toBe("พรุ่งนี้");
    expect(formatDayLabel("2026-10-01", now, timeZone, "th")).toBe("พฤ.");
    expect(formatDayLabel("2026-09-29", now, timeZone, "en")).toBe("Today");
    expect(formatDayLabel("2026-09-30", now, timeZone, "en")).toBe("Tomorrow");
    expect(formatDayLabel("2026-10-01", now, timeZone, "en")).toBe("Thu");
    expect(formatDayLabel("2026-09-29", now, "UTC", "en")).toBe("Tomorrow");
  });

  it("renders Thai Buddhist year and English Gregorian year in the local day", () => {
    const iso = "2026-09-28T17:30:00Z";
    expect(formatFullDate(iso, timeZone, "th")).toBe("อังคาร 29 ก.ย. 2569");
    expect(formatFullDate(iso, timeZone, "en")).toBe("Tue 29 Sep 2026");
    expect(formatFullDate(iso, "UTC", "en")).toBe("Mon 28 Sep 2026");
  });
});

describe("minutesAgo", () => {
  it("floors elapsed minutes and clamps future timestamps", () => {
    expect(minutesAgo("2026-09-28T10:00:00Z", "2026-09-28T10:00:59Z")).toBe(0);
    expect(minutesAgo("2026-09-28T10:00:00Z", "2026-09-28T10:02:59Z")).toBe(2);
    expect(minutesAgo("2026-09-28T10:01:00Z", "2026-09-28T10:00:00Z")).toBe(0);
  });
});

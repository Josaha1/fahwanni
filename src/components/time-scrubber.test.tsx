import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import { TimeScrubber } from "./time-scrubber";

it("exposes the actual reported date and index, including gaps, with Thai formatting", () => {
  const html = renderToStaticMarkup(<LocaleProvider locale="th"><TimeScrubber
    days={["2026-01-02", "2025-12-30"]} day="2026-01-02" onChange={vi.fn()} label="วัน" /></LocaleProvider>);
  expect(html).toContain('data-scrub-day="2026-01-02"');
  expect(html).toContain('data-scrub-index="1"');
  expect(html).toContain('max="1"');
  expect(html).toContain("2 ม.ค.");
});
it("disables playback under reduced motion and disables empty scrubbers", () => {
  for (const days of [[], ["2026-01-01", "2026-01-03"]]) {
    const html = renderToStaticMarkup(<LocaleProvider locale="th"><TimeScrubber days={days} day={null}
      onChange={vi.fn()} label="วัน" reducedMotion /></LocaleProvider>);
    expect(html).toContain('data-scrub-playing="false"');
    expect(html).toMatch(/<button[^>]*disabled=""/);
    if (!days.length) { expect(html).toContain('data-scrub-index="-1"'); expect(html).toMatch(/<input[^>]*disabled=""/); }
  }
});
it.each([0, 1])("shows only the satellite date and a notice for %i reported days", (count) => {
  const html = renderToStaticMarkup(<LocaleProvider locale="th"><TimeScrubber
    days={count ? ["2026-01-01"] : []} day={null} onChange={vi.fn()} label="ดาวเทียม" satellite /></LocaleProvider>);
  expect(html).toContain(`ดาวเทียมมีข้อมูลเพียง ${count} วันในสัปดาห์นี้`);
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<input");
  expect(html).toContain('data-scrub-playing="false"');
  if (count) { expect(html).toContain('data-scrub-day="2026-01-01"'); expect(html).toContain("1 ม.ค."); }
});
it("keeps satellite playback with two reported days and translates the single-day notice", () => {
  const html = renderToStaticMarkup(<LocaleProvider locale="th"><TimeScrubber
    days={["2026-01-01", "2026-01-03"]} day={null} onChange={vi.fn()} label="ดาวเทียม" satellite /></LocaleProvider>);
  expect(html).toContain("<button");
  expect(html).toContain('max="1"');
  expect(html).not.toContain("ดาวเทียมมีข้อมูลเพียง");
  const english = renderToStaticMarkup(<LocaleProvider locale="en"><TimeScrubber
    days={["2026-01-01"]} day={null} onChange={vi.fn()} label="Satellite" satellite /></LocaleProvider>);
  expect(english).toContain("Satellite data is available for only 1 day this week");
});

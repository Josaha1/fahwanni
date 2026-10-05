import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import fixture from "@/lib/dams/fixture-rid.json";
import { parseRidDams } from "@/lib/dams/rid";
import { chartDays, DamTrendChart } from "./dam-trend-chart";
import { DrainagePillar, DownstreamProvinces, downstreamProvinceIds } from "./drainage-pillar";

const trend = { dates: ["2026-10-01", "2026-10-03"], release: { dam: [0, 10] }, inflow: { dam: [5, null] }, pct: { dam: [80, 85] } };

it("keeps calendar gaps and missing inflow null, while retaining zero release", () => {
  const days = chartDays(trend, "dam", "2026-10-03");
  expect(days).toHaveLength(7);
  expect(days.at(-3)).toEqual({ date: "2026-10-01", release: 0, inflow: 5, pct: 80 });
  expect(days.at(-2)).toEqual({ date: "2026-10-02", release: null, inflow: null, pct: null });
  const html = renderToStaticMarkup(<LocaleProvider locale="en"><DamTrendChart trend={trend} id="dam" date="2026-10-03" /></LocaleProvider>);
  expect(html).toContain("Inflow (m³/s)");
  expect(html).toContain("Storage (% capacity)");
  expect(html).toContain("Gaps mean no report, not zero");
  // No adjacent valid values: connecting a line would falsely bridge missing days.
  expect(html).not.toContain('stroke-width="2"');
});

it("labels downstream provinces as approximate and limits them to four", () => {
  expect(downstreamProvinceIds("200101")).toHaveLength(4);
  const html = renderToStaticMarkup(<LocaleProvider locale="en"><DownstreamProvinces id="200101" /></LocaleProvider>);
  expect(html).toContain("Approximate downstream provinces");
  expect(html).toContain("Tak");
  expect(html).not.toContain("Bangkok");
});

it("keeps region filter values independent of translated English labels", () => {
  const report = parseRidDams(fixture);
  const html = renderToStaticMarkup(<LocaleProvider locale="en"><DrainagePillar
    dams={{ status: "ready", data: { ...report, fetchedAt: "2026-09-29T12:00:00Z", stale: false } }}
    place={{ id: "test", name: "Bangkok", lat: 13.7, lon: 100.5, source: "province" }} /></LocaleProvider>);
  expect(html).toContain('<option value="ภาคเหนือ">North</option>');
  expect(html).toContain('href="/water/dam/200101"');
});

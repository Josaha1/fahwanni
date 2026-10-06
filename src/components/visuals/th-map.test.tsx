import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import { ThMap } from "./th-map";
import { floodPoints, pathRings, provinceColor, provinceColors, regionOutline, thRegionOutlines, type ThMapData } from "./th-map-data";
import { regionByProvince } from "@/lib/flood/viirs";
import { thProvinces } from "@/lib/visuals/th-provinces";

const counts = (n: number) => ({ flood: n, recurringFlood: 0, dry: 1, water: 0, noData: 0, insufficientData: 0, sampled: n + 1 });
const data: ThMapData = { counts: { bangkok: counts(21) }, samples: [], affected: ["bangkok"], warnedRegions: ["central"] };
it("renders 77 accessible province targets, event hatching, region borders and the same caption", () => {
  const html = renderToStaticMarkup(<LocaleProvider locale="th"><ThMap {...data} onSelect={vi.fn()} /></LocaleProvider>);
  expect(html.match(/data-province=/g)).toHaveLength(77);
  expect(html.match(/role="button"/g)).toHaveLength(77);
  expect(html).toContain('data-warned-region="central"');
  expect(html).toContain('stroke="url(#event-');
  expect(html).toContain('fill="#fb923c"');
  expect(html).toContain('&quot;provinces&quot;:77');
  expect(html).toContain('&quot;warnedRegions&quot;:[&quot;central&quot;]');
  expect(html).toContain("จุดตรวจ ไม่ใช่พื้นที่");
});
it("uses all four bins and grey for unavailable observations", () => {
  expect([0, 1, 21, 201].map((n) => provinceColor(counts(n)))).toEqual(provinceColors);
  expect(provinceColor(null)).toBe("#9ca3af");
  expect(provinceColor({ ...counts(0), dry: 0, sampled: 0 })).toBe("#9ca3af");
});
it("only displays real flood points and evenly limits them to 3000", () => {
  const samples = Array.from({ length: 6000 }, (_, i) => ({ lat: i / 1000 + 10, lon: 100, kind: "flood" as const }));
  const points = floodPoints([...samples, { lat: 14, lon: 100, kind: "water" }]);
  expect(points).toHaveLength(3000); expect(points[0]).toEqual(samples[0]); expect(points.at(-1)).toEqual(samples.at(-1));
});
it("removes shared internal edges from regional warnings", () => {
  expect(regionOutline("north")).toBe(thRegionOutlines.north);
  const outlineEdges = [...thRegionOutlines.north.matchAll(/M([^M]+)/g)];
  expect(outlineEdges.length).toBeGreaterThan(0);
  const allEdges = thProvinces.filter((entry) => regionByProvince.get(entry.id) === "north")
    .reduce((sum, entry) => sum + pathRings(entry.d).reduce((n, ring) => n + ring.length, 0), 0);
  expect(outlineEdges.length).toBeLessThan(allEdges);
  expect(new Set(outlineEdges.map((edge) => edge[1])).size).toBe(outlineEdges.length);
});

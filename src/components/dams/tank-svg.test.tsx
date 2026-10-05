import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import fixture from "@/lib/dams/fixture-rid.json";
import { parseRidDams } from "@/lib/dams/rid";
import { damBand, damBandColor } from "@/lib/dams/bands";
import { tankGridData } from "./tank-grid-data";
import { GridTankSvg } from "./tank-svg";

const parsed = parseRidDams(fixture);
function entry(pct: number | null) {
  const dam = parsed.dams[0];
  const reports = pct === null ? [] : [{ ...dam, storagePct: pct }];
  return tankGridData(reports, parsed.dataDate, null).find((entry) => entry.id === dam.id)!;
}

it.each([[0, 140], [50, 90], [100, 40], [110, 30]])("draws %s percent at y=%s with a fixed crest", (pct, y) => {
  const html = renderToStaticMarkup(<GridTankSvg entry={entry(pct)} />);
  const path = html.match(/data-tank-fill="" d="([^"]+)"/)![1];
  expect(path.startsWith(`M42 ${y} `)).toBe(true);
  expect(path.endsWith("L194 140 L42 140 Z")).toBe(true);
  const points = [...path.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].slice(0, 65).map((match) => [Number(match[1]), Number(match[2])]);
  expect(points).toHaveLength(65);
  for (const [i, point] of points.entries()) {
    expect(point[1]).toBeCloseTo(y + (pct === 0 ? 0 : 2) * Math.sin(i * Math.PI / 16), 3);
  }
  expect(html).toContain('data-crest="" x1="34" x2="126" y1="40" y2="40"');
  expect(html).toContain(`data-status-rim="" d="M54 19H106" fill="none" stroke="${damBandColor(damBand(pct))}"`);
  expect(html).toContain('stop-color="#7dd3fc"');
  expect(html).toContain('stop-color="#0284c7"');
  expect(html).toMatch(/data-tank-fill=""[^>]+fill="url\(#water-/);
});

it("removes the animation class for reduced motion and stops it in CSS before hydration", () => {
  expect(renderToStaticMarkup(<GridTankSvg entry={entry(50)} />)).toContain('class="tank-wave"');
  expect(renderToStaticMarkup(<GridTankSvg entry={entry(50)} reducedMotion />)).not.toContain('class="tank-wave"');
  expect(renderToStaticMarkup(<GridTankSvg entry={entry(0)} />)).not.toContain('class="tank-wave"');
  expect(renderToStaticMarkup(<GridTankSvg entry={entry(null)} />)).not.toContain('class="tank-wave"');
  const css = readFileSync(new URL("./tank-svg.css", import.meta.url), "utf8");
  expect(css).toContain("translateX(-76px)");
  expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.tank-wave\s*\{ animation: none;/);
});

it("uses rounded glass and a white highlight, and hatches only missing reports", () => {
  const html = renderToStaticMarkup(<><GridTankSvg entry={entry(null)} /><GridTankSvg entry={entry(0)} /></>);
  expect(html).toContain('width="76" height="121" rx="12"');
  expect(html).toContain('width="7" height="105" rx="3.5" fill="#fff" opacity="0.35"');
  expect(html.match(/fill="url\(#missing-/g)).toHaveLength(1);
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
  expect(new Set(ids).size).toBe(ids.length);
});

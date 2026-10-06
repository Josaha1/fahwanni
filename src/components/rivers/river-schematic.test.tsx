import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LocaleProvider } from "@/i18n/client";
import fixture from "@/lib/dams/fixture-rid.json";
import { parseRidDams } from "@/lib/dams/rid";
import { schematicFlowWidth } from "./river-layout";
import { riverSystems } from "@/lib/rivers/systems";
import type { Dam } from "@/lib/dams/types";
import { RiverSchematic } from "./river-schematic";
import type { ProvinceGauge } from "./river-detail";

const system = riverSystems.find((system) => system.id === "chao-phraya")!;
const dams = parseRidDams(fixture).dams;
const edge = system.edges.find((edge) => edge.damIds.length === 2)!;
const reports = edge.damIds.map((id, index) => ({ ...dams.find((dam) => dam.id === id)!, releaseCms: index ? 200 : 100 }));
const render = (list: Dam[], gauges: ProvinceGauge[] = [], animate = true) => renderToStaticMarkup(<LocaleProvider locale="th"><RiverSchematic system={system} dams={list} gauges={gauges} animate={animate} /></LocaleProvider>);
const edgeMarkup = (html: string) => html.split(`data-edge="${edge.from}:${edge.to}"`)[1].split("</g>")[0];

it("uses the sum of exactly edge.damIds for log width and the speed bucket", () => {
  const markup = edgeMarkup(render([...reports, { ...dams.find((dam) => !edge.damIds.includes(dam.id))!, releaseCms: 2000 }]));
  expect(markup).toContain(`stroke-width="${schematicFlowWidth(300)}"`);
  expect(markup).toContain('data-bucket="fast"');
  expect(markup).toContain("ระบาย 300 ลบ.ม./วินาที");
  expect(markup).not.toContain("ขาด");
});

it("keeps missing upstream reports grey and dotted, with no animated bucket", () => {
  const markup = edgeMarkup(render(reports.map((dam) => ({ ...dam, releaseCms: null }))));
  expect(markup).toContain('stroke="var(--nodata)"');
  expect(markup).toContain('stroke-dasharray="1 5"');
  expect(markup).toContain('data-bucket="none"');
  expect(markup).toContain("ระบาย ไม่รายงาน");
  expect(markup).toContain("ขาด 2 เขื่อน");
});

it("keeps a partial sum coloured with long dashes, no repeated visible markers", () => {
  const markup = edgeMarkup(render(reports.slice(0, 1)));
  expect(markup).toContain(`stroke-width="${schematicFlowWidth(100)}"`);
  expect(markup).toContain('data-partial="true"');
  expect(markup).not.toContain('stroke="var(--nodata)"');
  expect(markup).toContain('stroke-dasharray="8 4"');
  expect(render(reports.slice(0, 1))).not.toContain('class="river-missing"');
  expect(markup).toContain("ขาด 1 เขื่อน");
  expect(markup).toContain("ระบาย 100 ลบ.ม./วินาที");
});

it("distinguishes a reported zero from no reports and uses all three motion buckets", () => {
  for (const [releaseCms, bucket] of [[0, "none"], [10, "slow"], [100, "mid"], [300, "fast"]] as const) {
    const markup = edgeMarkup(render(reports.map((dam, index) => ({ ...dam, releaseCms: index ? 0 : releaseCms }))));
    expect(markup).toContain(`data-bucket="${bucket}"`);
    expect(markup).toContain('stroke-dasharray="3 5"');
    expect(markup).not.toContain("nodata");
  }
});

it.each(riverSystems)("gives every $id node a title and the correct drill-down destination", (system) => {
  const html = renderToStaticMarkup(<LocaleProvider locale="en"><RiverSchematic system={system} dams={dams} gauges={[]} /></LocaleProvider>);
  const nodeGroups = [...html.matchAll(/<g data-node="([^"]+)"><title>([^<]+)<\/title>/g)];
  expect(nodeGroups.map((match) => match[1])).toEqual(system.nodes.map((node) => node.id));
  for (const node of system.nodes) {
    if (node.damId) expect(html).toContain(`href="/dam/${node.damId}"`);
    else if (node.kind === "province") expect(html).toContain(`href="/province/${node.provinceId}"`);
  }
  expect(html).not.toMatch(/[ก-๙]/);
  expect(html).toContain('width="100%"');
  expect(html).toContain('viewBox="-20 0 420 ');
});

it("shows HII ticks only at matching provinces with a month and level in the title", () => {
  const gauge: ProvinceGauge = { code: "test", name: "สถานีทดสอบ", nameEn: "Test station", provinceId: "nakhon-sawan", month: "2026-07", lat: 0, lon: 0, km: 0,
    levelMsl: { min: 1, mean: 2, max: 3 }, bankMsl: null, days: { from: "2026-07-01", to: "2026-07-31", count: 31 } };
  const html = render(dams, [gauge, { ...gauge, code: "absent", provinceId: "phuket" }]);
  expect(html.match(/data-gauge="test"/g)).toHaveLength(1);
  expect(html).toContain("HII (CC BY-NC) · ก.ค. 2569");
  expect(html).not.toContain('class="river-month"');
  expect(html.split('data-gauge="test"')[1].split("</g>")[0]).not.toContain("<text");
  expect(html).toContain("ระดับเฉลี่ย 2 ม.รทก.");
  expect(html).not.toContain('data-gauge="absent"');
  expect(render(dams)).not.toContain("data-gauge");
});

it("gates animation for lite/reduced motion and scales the SVG to its container", () => {
  expect(render(dams, [], false)).toContain('data-animate="false"');
  const css = readFileSync(new URL("./river-detail.css", import.meta.url), "utf8");
  expect(css).toContain("width: 100%; max-width: 100%; height: auto");
  expect(css).toMatch(/prefers-reduced-motion: reduce[^}]*animation: none !important/);
});


it("uses the 100 m³/s colour threshold for complete reports", () => {
  for (const [releaseCms, role] of [[99, "water"], [100, "release"]] as const) {
    const markup = edgeMarkup(render(reports.map((dam, index) => ({ ...dam, releaseCms: index ? 0 : releaseCms }))));
    expect(markup).toContain(`stroke="var(--${role})"`);
  }
});

it("retains confluence titles without displaying empty junction circles", () => {
  const html = render(dams);
  for (const node of system.nodes.filter((node) => node.kind === "confluence")) {
    const group = html.split(`data-node="${node.id}"`)[1].split("</g>")[0];
    expect(group).toContain("<title>");
    expect(group).not.toContain("<circle");
    expect(group).not.toContain("<text");
  }
  const height = Number(html.match(/viewBox="-20 0 420 ([\d.]+)"/)![1]);
  expect(height * 350 / 420).toBeLessThan(560);
});

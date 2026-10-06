import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/client";
import Page from "@/app/river/[system]/page";
import { riverSystems, riverSystemForDam } from "@/lib/rivers/systems";
import { DAM_REGISTRY } from "@/lib/dams/registry";
import { RiverDetail, type ProvinceGauge } from "./river-detail";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("@/hooks/use-lite", () => ({ useLite: () => ({ lite: true, reducedMotion: true }) }));
vi.mock("@/hooks/use-water-source", () => ({ useWaterSource: () => ({ status: "ready", data: { dataDate: "2026-10-06", dams: [
  { id: "200101", date: "2026-10-05", releaseCms: 100, storagePct: 85 },
  { id: "200102", date: "2026-10-06", releaseCms: 200, storagePct: 75 },
] } }) }));

it("rejects an unknown system", async () => {
  await expect(Page({ params: Promise.resolve({ system: "unknown" }) })).rejects.toThrow("NEXT_NOT_FOUND");
});

it.each(riverSystems)("resolves $id and attaches only gauges in its provinces", async (system) => {
  const page = await Page({ params: Promise.resolve({ system: system.id }) });
  expect(page.type).toBe(RiverDetail);
  expect(page.props.system.id).toBe(system.id);
  for (const gauge of page.props.gauges) expect(system.nodes.some((node) => node.kind === "province" && node.provinceId === gauge.provinceId)).toBe(true);
  if (system.id === "chao-phraya") expect(page.props.gauges.map((gauge: ProvinceGauge) => gauge.code)).toContain("CPY001");
});

it.each(["th", "en"] as const)("renders %s with the honesty warning and one dated source line", async (locale) => {
  const page = await Page({ params: Promise.resolve({ system: "chao-phraya" }) });
  const html = renderToStaticMarkup(<LocaleProvider locale={locale}>{page}</LocaleProvider>);
  expect(html).toContain(locale === "th" ? "ตัวเลข = น้ำที่ระบายจากเขื่อน ไม่ใช่น้ำที่วัดในแม่น้ำ" : "Numbers = dam releases, not river measurements");
  const source = html.split('class="river-source text-xs"')[1].split("</span>")[0];
  expect(source).toContain(locale === "th" ? "5 ต.ค." : "5 Oct");
  expect(html).toContain('data-animate="false"');
  const missing = locale === "th" ? "ไม่รายงานวันนี้:" : "Not reported today:";
  expect(html.split(missing)).toHaveLength(2);
  expect(html).toContain(locale === "th" ? "ทับเสลา" : "Thap Salao");
  expect(html).not.toContain('class="river-missing"');
  expect(html).not.toContain("ปลอดภัย");
  if (locale === "en") expect(html).not.toMatch(/[ก-๙]/);
});

it("maps all registered dams to their existing system, including other rivers", () => {
  for (const dam of DAM_REGISTRY) expect(riverSystemForDam(dam.id)?.nodes.some((node) => node.damId === dam.id)).toBe(true);
  expect(riverSystemForDam("200401")?.id).toBe("other");
});

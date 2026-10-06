import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { translator } from "@/i18n/core";
import fixture from "@/lib/dams/fixture-rid.json";
import { parseRidDams } from "@/lib/dams/rid";
import DamPage from "@/app/embed/dam/[id]/page";
import ProvincePage from "@/app/embed/province/[id]/page";
import nextConfig from "../../../next.config";

const mocks = vi.hoisted(() => ({ dam: vi.fn(), province: vi.fn(), locale: "th" as "th" | "en" }));
vi.mock("@/components/share/embed-data", () => ({ damEmbedData: mocks.dam, provinceEmbedData: mocks.province }));
vi.mock("@/i18n/server", () => ({ getT: async () => translator(mocks.locale) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

beforeEach(() => {
  mocks.locale = "th";
  const dam = { ...parseRidDams(fixture).dams.find((entry) => entry.id === "200101")!, date: "2026-10-05" };
  mocks.dam.mockResolvedValue({ dams: { dams: [dam] }, trend: null });
  mocks.province.mockResolvedValue({ dams: { dams: [dam] }, flood: { date: "2026-10-04", provinceCounts: { "phra-nakhon-si-ayutthaya": { sampled: 10, flood: 2, recurringFlood: 1, insufficientData: 4, noData: 0 } } } });
});

it.each(["th", "en"] as const)("server renders both %s embed pages with sources, dates and full-page links", async (locale) => {
  mocks.locale = locale;
  const damHtml = renderToStaticMarkup(await DamPage({ params: Promise.resolve({ id: "200101" }) }));
  const provinceHtml = renderToStaticMarkup(await ProvincePage({ params: Promise.resolve({ id: "phra-nakhon-si-ayutthaya" }) }));
  const day = (n: number) => locale === "en" ? `${n} Oct` : `${n} ต.ค.`;
  expect(damHtml).toContain(day(5));
  expect(damHtml).toContain(locale === "en" ? "Royal Irrigation Department" : "กรมชลประทาน");
  expect(damHtml).toContain('href="/dam/200101"');
  expect(provinceHtml).toContain("NASA VIIRS");
  expect(provinceHtml).toContain(day(4));
  expect(provinceHtml).toContain(day(5));
  expect(provinceHtml).toContain('href="/province/phra-nakhon-si-ayutthaya"');
  expect(damHtml + provinceHtml).not.toMatch(/<nav|<canvas|maplibre/i);
  if (locale === "en") expect(damHtml + provinceHtml).not.toMatch(/[ก-๙]/);
});

it("renders absent reports as dashes and rejects unknown IDs", async () => {
  mocks.dam.mockResolvedValue({ dams: null, trend: null });
  mocks.province.mockResolvedValue({ dams: null, flood: null });
  for (const [page, id] of [[DamPage, "200101"], [ProvincePage, "phra-nakhon-si-ayutthaya"]] as const) {
    expect(renderToStaticMarkup(await page({ params: Promise.resolve({ id }) }))).toContain("—");
    await expect(page({ params: Promise.resolve({ id: "unknown" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  }
});

it("limits the iframe permission header to embed paths", async () => {
  expect(await nextConfig.headers!()).toEqual([{ source: "/embed/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] }]);
});

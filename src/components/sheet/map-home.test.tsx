import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import { HomeContent } from "./map-home";
import type { Load } from "@/hooks/use-water-source";

const { state } = vi.hoisted(() => ({ state: { lite: false, lens: "flood", detent: null as string | null, sources: new Map<string, Load<unknown>>() } }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useState: (initial: unknown) => {
    const value = typeof initial === "function" ? initial() : initial;
    return react.useState(initial === "flood" ? state.lens : value === "half" && state.detent ? state.detent : value);
  } };
});
vi.mock("next/dynamic", async () => {
  const { MapView } = await import("@/components/map/map-view");
  return { default: () => MapView };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/use-lite", () => ({ useLite: () => ({ lite: state.lite, reducedMotion: state.lite,
  device: { reducedMotion: state.lite, saveData: false } }) }));
vi.mock("@/hooks/use-water-source", () => ({ useWaterSource: (url: string) => state.sources.get(url.split("?")[0]) ?? { status: "error", data: null } }));
vi.mock("@/hooks/use-favourites", () => ({
  useLastPlace: () => ({ place: { id: "bangkok", name: "กรุงเทพมหานคร", lat: 13.7, lon: 100.5 }, setPlace: vi.fn() }),
  useFavourites: () => ({ favourites: [], remove: vi.fn() }),
}));
const render = (mounted = false) => renderToStaticMarkup(<LocaleProvider locale="th"><HomeContent fallback={state.lite} mounted={mounted} /></LocaleProvider>);
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => { state.lite = false; state.lens = "flood"; state.detent = null; state.sources.clear(); });

it("opens at peek with three sourced tiles and emergency links even when sources fail", () => {
  const html = render();
  expect(html).toContain('data-detent="peek"');
  expect(html.match(/class="home-tile"/g)).toHaveLength(3);
  for (const phone of [1784, 1669, 191]) expect(html).toContain(`href="tel:${phone}"`);
  expect(html).toContain("พบน้ำ — จุด");
  expect(html).toContain("เมฆ —%");
  expect(html).toContain("NASA VIIRS");
  expect(html).toContain("กรมชลประทาน");
  expect(html).not.toContain("ปลอดภัย");
  expect(html).not.toContain("ตารางเขื่อนทั้งหมด");
});
it("uses API counts rather than thinned points and includes every dam with its own source date in lite full", () => {
  state.lite = true;
  state.detent = "full";
  const counts = { flood: 9, recurringFlood: 3, dry: 2, water: 1, insufficientData: 5, noData: 0, sampled: 20 };
  state.sources.set("/api/flood-now", { status: "ready", data: { date: "2026-10-06", provinceCounts: { bangkok: counts }, nearMe: { counts, samples: [] } } });
  state.sources.set("/api/dams", { status: "ready", data: { dataDate: "2026-10-06", dams: [
    { id: "dam", nameTh: "เขื่อนทดสอบ", storagePct: 90, storageMcm: 500, inflowCms: 0, releaseCms: null, date: "2026-10-05" },
  ] } });
  const html = render();
  expect(html).toContain('data-detent="full"');
  expect(html).toContain('data-th-map-fallback=""');
  expect(html).toContain("พบน้ำ 12 จุด");
  expect(html).toContain("เมฆ 25%");
  expect(html).toContain("ดาวเทียมพบน้ำ 1 จังหวัด");
  expect(html).toContain('href="/dam/dam"');
  expect(html).toContain("ตารางเขื่อนทั้งหมด");
  expect(html).toContain("คัดลอกพร้อมที่มา");
  expect(html).toContain("<td>0</td><td>—</td>");
});

it("renders the hydrated / map container across the viewport behind the sheet", () => {
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn(), location: { search: "?gl=force" }, matchMedia: () => ({ matches: false }) });
  const html = render(true);
  expect(html).toContain('class="map-shell map-home-canvas"');
  expect(html).toContain('style="position:absolute;inset:0;width:100%;height:100%" role="region" aria-label="แผนที่"');
  expect(html.indexOf('aria-label="แผนที่"')).toBeLessThan(html.indexOf('class="home-sheet"'));
  const css = readFileSync(new URL("./map-home.css", import.meta.url), "utf8");
  expect(css).toMatch(/\.map-home\s*\{[^}]*height: 100dvh/);
  expect(css).toMatch(/\.map-home \.map-home-canvas\s*\{[^}]*position: absolute; inset: 0; height: 100%/);
});

it("starts lite at half and fits the Thailand SVG above the sheet", () => {
  state.lite = true;
  const html = render(true);
  expect(html).toContain('data-detent="half"');
  expect(html.match(/data-province=/g)).toHaveLength(77);
  expect(html).not.toContain('class="map-shell map-home-canvas"');
  expect(html).not.toContain("ตารางเขื่อนทั้งหมด");
  for (const id of ["chao-phraya", "chi-mun", "mekong", "tapi", "pattani"]) expect(html).toContain(`href="/river/${id}"`);
  expect(html).not.toContain('href="/river/other"');
  const css = readFileSync(new URL("./map-home.css", import.meta.url), "utf8");
  expect(css).toMatch(/\.home-svg\s*\{[^}]*height: 45%/);
  expect(css).toMatch(/\.home-svg \[data-th-map\]\s*\{[^}]*flex: 1; min-height: 0; height: auto/);
});

it.each([
  ["flood", "NASA VIIRS", "2026-10-05", "5 ต.ค."],
  ["dams", "กรมชลประทาน", "2026-10-04", "4 ต.ค."],
  ["rain", "กรมอุตุนิยมวิทยา", "2026-10-03", "3 ต.ค."],
])("keeps %s attribution once below the list instead of in every row", (lens, source, date, label) => {
  state.lite = true;
  state.lens = lens;
  const counts = { flood: 9, recurringFlood: 3, dry: 2, water: 1, insufficientData: 5, noData: 0, sampled: 20 };
  state.sources.set("/api/flood-now", { status: "ready", data: { date, provinceCounts: { bangkok: counts, "chiang-mai": counts } } });
  state.sources.set("/api/dams", { status: "ready", data: { dataDate: date, dams: [
    { id: "one", nameTh: "เขื่อนหนึ่ง", storagePct: 90, releaseCms: 100, date },
    { id: "two", nameTh: "เขื่อนสอง", storagePct: 80, releaseCms: 50, date },
  ] } });
  state.sources.set("/api/rain-risk", { status: "ready", data: { observedAt: date, all: [
    { id: "one", nameTh: "สถานีหนึ่ง", rainMm: 10 }, { id: "two", nameTh: "สถานีสอง", rainMm: 5 },
  ] } });
  const html = render();
  const list = html.split('<div class="home-rows">')[1].split('</div>')[0];
  expect(list.match(/class="home-row"/g)).toHaveLength(2);
  expect(list).not.toContain("home-source");
  expect(list).not.toContain(source);
  const footer = html.split('<div class="home-rows">')[1].split('</div>')[1].split('</p>')[0];
  expect(footer.split(source)).toHaveLength(2);
  expect(footer).toContain(label);
  if (lens === "flood") expect(footer).toContain("จุดตรวจจากดาวเทียม ไม่ใช่ขนาดพื้นที่");
});

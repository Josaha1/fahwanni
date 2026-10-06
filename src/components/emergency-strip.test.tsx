import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/client";
import { damRegistryById } from "@/lib/dams/registry";
import { riverSystems } from "@/lib/rivers/systems";
import { provinces } from "@/lib/provinces";
import { DamDetail } from "./dams/dam-detail";
import { RiverDetail } from "./rivers/river-detail";
import { ProvinceDetail } from "./provinces/province-detail";
import { AlertsDetail } from "./alerts/alerts-detail";
import { EmergencyStrip } from "./emergency-strip";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/hooks/use-lite", () => ({ useLite: () => ({ lite: true, reducedMotion: true }) }));
vi.mock("@/hooks/use-water-source", () => ({ useWaterSource: () => ({ status: "error", data: null, loadedAt: null }) }));

it.each(["th", "en"] as const)("renders three labelled emergency telephone links in %s", (locale) => {
  const html = renderToStaticMarkup(<LocaleProvider locale={locale}><EmergencyStrip /></LocaleProvider>);
  expect(html).toContain(`<nav class="emergency-strip" aria-label="${locale === "th" ? "เบอร์ฉุกเฉิน" : "Emergency numbers"}">`);
  expect(html.match(/<a /g)).toHaveLength(3);
  for (const phone of ["1784", "1669", "191"]) expect(html).toMatch(new RegExp(`href="tel:${phone}">[^<]+${phone}</a>`));
  if (locale === "en") expect(html).not.toMatch(/[ก-๙]/);
});

it.each([
  ["dam", <DamDetail key="dam" registered={damRegistryById.get("200101")!} />],
  ["river", <RiverDetail key="river" system={riverSystems[0]} gauges={[]} />],
  ["province", <ProvinceDetail key="province" province={provinces.find((province) => province.id === "bangkok")!} bbox={[100.3, 13.5, 100.9, 14]} />],
  ["alerts", <AlertsDetail key="alerts" />],
])("keeps one emergency strip at the end of the %s sheet when data is unavailable", (_, page) => {
  const html = renderToStaticMarkup(<LocaleProvider locale="th">{page}</LocaleProvider>);
  expect(html.match(/class="emergency-strip"/g)).toHaveLength(1);
  for (const phone of ["1784", "1669", "191"]) expect(html.match(new RegExp(`href="tel:${phone}"`, "g"))).toHaveLength(1);
  expect(html).toMatch(/<nav class="emergency-strip"[^>]*>.*<\/nav><\/div><\/main>$/);
});

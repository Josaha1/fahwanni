import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import { RainTube } from "./rain-tube";

it("keeps real totals in the caption while capping geometry, with hatch for models", () => {
  const html = renderToStaticMarkup(<LocaleProvider locale="en"><RainTube mm={240} model /></LocaleProvider>);
  expect(html).toContain('height="100"');
  expect(html).toContain('fill="url(#');
  expect(html).toContain('aria-label="Rain 240 mm · Very heavy rain"');
  expect(html).toContain('<figcaption');
  expect(html).not.toMatch(/[ก-๙]/);
});
it("distinguishes unavailable from zero rain", () => {
  expect(renderToStaticMarkup(<RainTube mm={null} />)).toContain("ไม่มีข้อมูลฝน");
  expect(renderToStaticMarkup(<RainTube mm={0} />)).toContain("ฝน 0 มม.");
});

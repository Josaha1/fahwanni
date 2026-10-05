import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import { PrimaryPicker } from "./primary-picker";

const state = vi.hoisted(() => ({ focus: "flood" as "flood" | "all" }));
vi.mock("@/lib/features", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/features")>();
  return { ...original, isOn: (feature: import("@/lib/features").Feature) => original.isOn(feature, state.focus) };
});

describe("PrimaryPicker feature focus", () => {
  const render = (variant: "segment" | "grid") => renderToStaticMarkup(
    <LocaleProvider locale="th">
      <PrimaryPicker primary="rain" tempAvailable cloudAvailable pm25Loading={false} onChange={() => {}} variant={variant} />
    </LocaleProvider>,
  );

  it.each(["segment", "grid"] as const)("shows only rain in the flood %s picker", (variant) => {
    state.focus = "flood";
    const html = render(variant);
    expect(html.match(/role="radio"/g)).toHaveLength(1);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("ฝน");
  });

  it.each(["segment", "grid"] as const)("restores all primaries in the all %s picker", (variant) => {
    state.focus = "all";
    const html = render(variant);
    expect(html.match(/role="radio"/g)).toHaveLength(6);
    for (const label of ["ฝน", "อุณหภูมิ", "ดัชนีความร้อน", "ฝุ่น PM2.5", "เมฆ", "ดาวเทียม"]) expect(html).toContain(label);
  });
});

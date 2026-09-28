import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import { AqiCard } from "./aqi-card";

describe("AqiCard", () => {
  it("shows the Thai AQI only for the PCD local index", () => {
    const render = (code: string) => renderToStaticMarkup(
      <LocaleProvider locale="th">
        <AqiCard air={{ pm25: 15, localAqi: { code, aqi: 41, category: "ดี" } }} />
      </LocaleProvider>,
    );

    expect(render("tha_pcd")).toContain("AQI (ไทย) 41 · ดี");
    expect(render("tha")).not.toContain("AQI (ไทย)");
  });
});

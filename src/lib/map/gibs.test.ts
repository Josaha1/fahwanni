import { describe, expect, it } from "vitest";
import { floodDate, gibsTileUrl } from "./gibs";

describe("GIBS flood tiles", () => {
  it("uses yesterday in UTC, including across month and year boundaries", () => {
    expect(floodDate(Date.parse("2026-09-29T00:01:00Z"))).toBe("2026-09-28");
    expect(floodDate(Date.parse("2026-01-01T23:59:00Z"))).toBe("2025-12-31");
  });

  it("builds the same WMTS path for VIIRS and MODIS", () => {
    for (const layer of ["VIIRS_Combined_Flood_2-Day", "MODIS_Combined_Flood_2-Day"] as const) {
      expect(gibsTileUrl(layer, "2026-09-28", { z: 6, y: 29, x: 50 })).toBe(
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/2026-09-28/GoogleMapsCompatible_Level9/6/29/50.png`);
    }
  });
  it("builds time-specific level-6 weather tiles", () => {
    expect(gibsTileUrl("Himawari_AHI_Band13_Clean_Infrared", "2026-09-29T13:20:00Z", { z: "{z}", y: "{y}", x: "{x}" }, "GoogleMapsCompatible_Level6")).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Himawari_AHI_Band13_Clean_Infrared/default/2026-09-29T13:20:00Z/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png");
    expect(gibsTileUrl("IMERG_Precipitation_Rate_30min", "2026-09-29T08:30:00Z", { z: 5, y: 14, x: 25 }, "GoogleMapsCompatible_Level6")).toContain(
      "/IMERG_Precipitation_Rate_30min/default/2026-09-29T08:30:00Z/GoogleMapsCompatible_Level6/5/14/25.png");
  });
});

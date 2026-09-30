import { describe, expect, it } from "vitest";
import { floodDate, gibsTileUrl, thermalAnomaliesDefault, thermalTileUrl } from "./gibs";

describe("GIBS tiles", () => {
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
  it("builds a dated VIIRS WMS tile URL with a MapLibre bounding box", () => {
    expect(thermalTileUrl("2026-09-28")).toBe(
      "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=VIIRS_NOAA20_Thermal_Anomalies_375m_All&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true&TIME=2026-09-28");
  });
  it("defaults thermal anomalies on only for PM2.5 in January through April Bangkok time", () => {
    for (const month of [0, 1, 2, 3]) expect(thermalAnomaliesDefault("pm25", Date.UTC(2026, month, 1))).toBe(true);
    for (const month of [4, 8, 11]) expect(thermalAnomaliesDefault("pm25", Date.UTC(2026, month, 1))).toBe(false);
    expect(thermalAnomaliesDefault("rain", Date.UTC(2026, 2, 1))).toBe(false);
    expect(thermalAnomaliesDefault("pm25", Date.parse("2026-05-01T00:01:00+07:00"))).toBe(false);
    expect(thermalAnomaliesDefault("pm25", Date.parse("2026-01-01T00:01:00+07:00"))).toBe(true);
  });
});

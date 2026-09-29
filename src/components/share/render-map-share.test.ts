import { describe, expect, it } from "vitest";
import { coverCrop, mapSourceLine } from "./render-map-share";

describe("map image layout", () => {
  it("crops wide and tall map canvases around their center without distortion", () => {
    expect(coverCrop(1600, 900, 1080, 800)).toEqual({ x: 192.5, y: 0, width: 1215, height: 900 });
    expect(coverCrop(390, 844, 1080, 800)).toEqual({ x: 0, y: (844 - 390 / 1.35) / 2, width: 390, height: 390 / 1.35 });
  });
});

describe("map image sources", () => {
  it("names the active weather providers", () => {
    expect(mapSourceLine({ water: false, primary: "rain", radar: true, rainRisk: false, rainAccum: false }))
      .toEqual(["RainViewer", "Open-Meteo"]);
    expect(mapSourceLine({ water: false, primary: "temp", radar: false, rainRisk: false, rainAccum: false }))
      .toEqual(["Open-Meteo"]);
  });

  it("adds observed and modelled water sources for visible layers", () => {
    expect(mapSourceLine({ water: true, primary: "rain", radar: true, rainRisk: true, rainAccum: true }))
      .toEqual(["GloFAS ผ่าน Open-Meteo (CC BY 4.0)", "กรมชลประทาน", "กรมอุตุนิยมวิทยา", "Open-Meteo", "RainViewer"]);
    expect(mapSourceLine({ water: true, primary: "rain", radar: false, rainRisk: false, rainAccum: false }))
      .toEqual(["GloFAS ผ่าน Open-Meteo (CC BY 4.0)", "กรมชลประทาน"]);
  });
});

import { describe, expect, it } from "vitest";
import { humidityFrom, nearestAirports, parseMetar, visibilityKm, weatherCodes } from "./metar";

describe("METAR", () => {
  it("parses a real Suvarnabhumi report", () => {
    const obs = parseMetar({ icaoId: "VTBS", obsTime: 1790850600, temp: 28, dewp: 23, wdir: 300, wspd: 8,
      rawOb: "METAR VTBS 011030Z 30008KT 9999 FEW020 28/23 Q1010 NOSIG" })!;
    expect(obs).toMatchObject({ icao: "VTBS", observedAt: "2026-10-01T10:30:00.000Z", tempC: 28, humidity: 74, windKmh: 15, windFrom: 300,
      visibilityKm: 10, storm: false, weather: [] });
  });

  it("flags thunderstorms from TS or CB clouds and reads present weather", () => {
    const raw = "METAR VTCC 011000Z 24012G25KT 4000 TSRA BR FEW015CB SCT020 BKN080 25/24 Q1008 TEMPO 2000 +TSRA";
    expect(weatherCodes(raw)).toEqual(["thunder", "rain", "mist"]);
    expect(parseMetar({ icaoId: "VTCC", obsTime: 1790848800, temp: 25, dewp: 24, wdir: 240, wspd: 12, wgst: 25, rawOb: raw }))
      .toMatchObject({ storm: true, visibilityKm: 4, gustKmh: 46 });
    expect(parseMetar({ icaoId: "VTSP", obsTime: 1, temp: 30, dewp: 25, wspd: 5, rawOb: "METAR VTSP 011030Z 27005KT 9999 FEW020CB 30/25 Q1010" })?.storm).toBe(true);
    expect(visibilityKm("METAR VTSF 011000Z 08005KT CAVOK 31/26 Q1010")).toBe(10);
    expect(visibilityKm("METAR VTCN 011000Z VRB02KT 0800 FG VV001 22/22 Q1012")).toBe(0.8);
  });

  it("computes humidity and finds the nearest airports within range", () => {
    expect(humidityFrom(30, 30)).toBe(100);
    const airports = [{ icao: "VTBS", name: "Suvarnabhumi", nameTh: "สุวรรณภูมิ", lat: 13.686, lon: 100.767 }, { icao: "VTCC", name: "Chiang Mai", nameTh: "เชียงใหม่", lat: 18.767, lon: 98.963 }];
    expect(nearestAirports({ lat: 13.75, lon: 100.5 }, airports).map((item) => item.airport.icao)).toEqual(["VTBS"]);
  });
});

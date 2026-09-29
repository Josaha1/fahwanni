import { describe, expect, it } from "vitest";
import fixture from "./fixture-thaiwater.json";
import {
  damBand, damBandColor, damBandWord, parseThaiWater, stationSituation,
  stationSituationColor, situationWord,
} from "./thaiwater";

describe("parseThaiWater", () => {
  it("normalizes the trimmed real feed, including official bands and units", () => {
    const result = parseThaiWater(fixture);
    expect(result.dams).toHaveLength(10);
    expect(result.stations).toHaveLength(7);
    expect(result.dataDate).toBe("2026-09-28");

    expect(result.dams.find((dam) => dam.nameTh === "ประแสร์")).toMatchObject({
      id: "33", storagePct: 112.2, band: 5, highRelease: true,
      inflowCms: 318.3, releaseCms: 323.4,
    });
    expect(result.dams.find((dam) => dam.nameTh === "ป่าสักชลสิทธิ์")?.band).toBe(4);
    expect(result.dams.find((dam) => dam.nameTh === "ภูมิพล")).toMatchObject({
      agency: "RID", province: { th: "ตาก" }, capacityMcm: 13462,
      inflowCms: 528.4, releaseCms: 34.7,
    });
    expect(result.stations.find((station) => station.code === "K.58")?.dischargeCms).toBeNull();
    expect(result.stations.find((station) => station.code === "C.13")).toMatchObject({
      time: "2026-09-29T08:00:00+07:00", dischargeCms: 2000, qmaxCms: 2720,
    });
    expect(result.barrage).toMatchObject({
      id: "chao-phraya", lat: 15.16384, lon: 100.18792,
      dischargeCms: 2000, qmaxCms: 2720, situation: 4,
    });
  });

  it("matches the hard-coded ThaiWater setting scales", () => {
    for (const row of fixture.dam.setting.scale) {
      const level = Number(row.level) as 1 | 2 | 3 | 4 | 5;
      expect(damBandColor(level)).toBe(row.color);
      const threshold = Number(row.term);
      expect(damBand(row.operator === "<=" ? threshold : threshold + 0.01)).toBe(level);
    }
    for (const [index, row] of fixture.waterlevel.setting.scale.entries()) {
      const level = (5 - index) as 1 | 2 | 3 | 4 | 5;
      expect(stationSituationColor(level)).toBe(row.color);
      expect(situationWord(level)).toBe(row.situation);
      const threshold = Number(row.term);
      expect(stationSituation(row.operator === "<=" ? threshold : threshold + 0.01)).toBe(level);
    }
    expect(damBandWord(1)).toBe("น้ำน้อยวิกฤต");
    expect(damBandWord(5)).toBe("เกินความจุ");
  });

  it("skips invalid items while retaining records with missing optional values", () => {
    const dam: Record<string, unknown> = structuredClone(fixture.dam.data.data[0]);
    delete dam.dam_released;
    dam.dam_inflow = "NaN";
    const station: Record<string, unknown> = structuredClone(fixture.waterlevel.data.data[0]);
    station.situation_level = null;
    station.storage_percent = "";
    const raw = {
      dam: { data: { data: [dam, { dam: { id: 999 } }, fixture.dam.data.data[9]] } },
      waterlevel: { data: { data: [station, { station: { tele_station_oldcode: "bad" } }] } },
    };
    const result = parseThaiWater(raw);
    expect(result.dams).toHaveLength(2);
    expect(result.dams[0]).toMatchObject({ inflowMcmDay: null, releaseMcmDay: null, inflowCms: null, releaseCms: null });
    expect(result.stations).toHaveLength(1);
    expect(result.stations[0]).toMatchObject({ pctBank: null, situation: null, dischargeCms: null });
    expect(result.barrage).toBeNull();
  });

  it("uses bank percentage when situation level is invalid", () => {
    const station = { ...fixture.waterlevel.data.data[2], situation_level: 9, storage_percent: "100.01" };
    const result = parseThaiWater({ waterlevel: { data: { data: [station] } } });
    expect(result.stations[0].situation).toBe(5);
    expect(result.barrage?.situation).toBe(5);
  });

  it("returns empty results for unrelated input", () => {
    expect(parseThaiWater("garbage")).toEqual({ dams: [], stations: [], barrage: null, dataDate: null });
    expect(parseThaiWater({ dam: null, waterlevel: {} })).toEqual({ dams: [], stations: [], barrage: null, dataDate: null });
  });
});

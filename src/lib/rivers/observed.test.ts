import { describe, expect, it } from "vitest";
import observedData from "../../../public/data/observed-points.json";
import riverData from "../../../public/data/river-points.json";
import { damRegistryById } from "../dams/registry";
import { provinces } from "../provinces";
import type { ObservedPoint } from "./types";

const points: ObservedPoint[] = observedData.points;

describe("observed points config", () => {
  it("keeps the nine approved stations, coordinates and upstream dams", () => {
    expect(points.map(({ id, gauge, lat, lon, dams }) => [id, gauge, lat, lon, dams])).toEqual([
      ["maeklong-ratchaburi", "RAJ001", 13.63307, 99.81636, ["200401", "200402"]],
      ["nan-phitsanulok", "NAN012", 16.864717, 100.24477, ["200102", "100107"]],
      ["pasak-ayutthaya", "PAS009", 14.40269, 100.58636, ["100301"]],
      ["bangpakong-chachoengsao", "BPK003", 13.870314, 101.145744, ["100501", "100502", "100514"]],
      ["sakaekrang-uthaithani", "SKG002", 15.37083, 100.04418, ["100302"]],
      ["thachin-suphanburi", "THA005", 14.47051, 100.11473, []],
      ["songkhram-nakhonphanom", "SKM004", 17.674871, 104.28583, ["100202"]],
      ["phetchaburi-mueang", "PCH001", 13.08563, 99.94397, ["200601"]],
      ["pranburi-mueang", "PRN001", 12.38992, 99.91118, ["100602"]],
    ]);
  });

  it("has unique ids that do not collide with model points", () => {
    expect(new Set(points.map((point) => point.id)).size).toBe(points.length);
    const modelIds = new Set(riverData.points.map((point) => point.id));
    for (const point of points) expect(modelIds.has(point.id), point.id).toBe(false);
  });

  it("references only registered dams without counting any dam twice", () => {
    for (const point of points) {
      expect(new Set(point.dams).size, point.id).toBe(point.dams.length);
      for (const damId of point.dams) expect(damRegistryById.has(damId), `${point.id}: ${damId}`).toBe(true);
    }
  });

  it("uses known province ids and nonempty river and display names", () => {
    for (const point of points) {
      expect(provinces.some((province) => province.id === point.provinceId), point.id).toBe(true);
      expect(point.river.trim(), point.id).not.toBe("");
      expect(point.nameTh.trim(), point.id).not.toBe("");
      expect(point.nameEn.trim(), point.id).not.toBe("");
    }
  });

  it("pins HII gauge codes with three uppercase letters and three digits", () => {
    for (const point of points) expect(point.gauge, point.id).toMatch(/^[A-Z]{3}\d{3}$/);
  });
});

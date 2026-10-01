import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ensoStatus, parseOni } from "./enso";

const text = readFileSync(new URL("./fixture-oni.txt", import.meta.url), "utf8");

describe("ENSO from ONI", () => {
  it("parses the CPC text file (header skipped)", () => {
    const seasons = parseOni(text);
    expect(seasons[0]).toEqual({ season: "DJF", year: 1950, anomaly: expect.any(Number) });
    expect(seasons.at(-1)).toEqual({ season: "JJA", year: 2026, anomaly: 1.8 });
  });

  it("reads strong El Niño conditions that are not yet an official episode (3 of 5 seasons)", () => {
    expect(ensoStatus(parseOni(text))).toMatchObject({ phase: "el-nino", strength: "strong", run: 3, officialEpisode: false });
  });

  it("classifies La Niña, neutral and an official episode", () => {
    const series = (values: number[]) => values.map((anomaly, i) => ({ season: "XXX", year: 2020 + i, anomaly }));
    expect(ensoStatus(series([-0.6, -0.8, -1.1, -1.2, -1.0]))).toMatchObject({ phase: "la-nina", strength: "moderate", run: 5, officialEpisode: true });
    expect(ensoStatus(series([0.2, 0.4]))).toMatchObject({ phase: "neutral", strength: null, officialEpisode: false });
    expect(ensoStatus([])).toBeNull();
  });
});

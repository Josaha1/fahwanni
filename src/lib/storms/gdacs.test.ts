import { describe, expect, it } from "vitest";
import fixture from "./fixtures/gdacs-events.json";
import { gdacsSchema, parseGdacsStorms } from "./gdacs";

describe("GDACS fixture", () => {
  it("parses the real GeoJSON and drops the -114 longitude storm", () => {
    expect(gdacsSchema.parse(fixture).features).toHaveLength(2);
    const storms = parseGdacsStorms(fixture, new Date("2026-09-25T00:00:00Z"));
    expect(storms).toHaveLength(1);
    expect(storms[0]).toMatchObject({ id: "1001326", alertLevel: "Orange", position: { lat: 18.1, lon: 83.7 } });
    expect(storms[0].url).toContain("report.aspx");
  });

  it("drops the in-bbox storm when its end date is older than two days", () => {
    expect(parseGdacsStorms(fixture, new Date("2026-09-28T06:00:00Z"))).toEqual([]);
  });
});

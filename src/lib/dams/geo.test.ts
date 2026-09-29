import { describe, expect, it } from "vitest";
import { alongKm, douglasPeucker, pointToSegmentKm } from "../../../scripts/dams/geo.mjs";

describe("dam path geometry", () => {
  it("measures a station against the middle of a segment", () => {
    expect(pointToSegmentKm([100.005, 0.01], [100, 0], [100.01, 0])).toBeCloseTo(1.112, 2);
    expect(pointToSegmentKm([100.02, 0], [100, 0], [100.01, 0])).toBeCloseTo(1.112, 2);
  });

  it("reports distance from the start to the nearest point on the path", () => {
    const path = [[100, 0], [100.01, 0], [100.01, 0.01]];
    expect(alongKm([100.015, 0.005], path)).toMatchObject({
      distanceKm: expect.closeTo(0.556, 2),
      km: expect.closeTo(1.668, 2),
    });
    expect(alongKm([100.005, 0], path).km).toBeCloseTo(0.556, 2);
    expect(alongKm([100.005, 0], path)).toMatchObject({
      segmentIndex: 1, point: [100.005, 0],
    });
  });

  it("removes small bends while retaining corners and endpoints", () => {
    const path = [[0, 0], [1, 0.001], [2, 0], [2, 1], [2, 2]];
    expect(douglasPeucker(path, 0.003)).toEqual([[0, 0], [2, 0], [2, 2]]);
    expect(douglasPeucker(path.slice(0, 2), 0.003)).toEqual(path.slice(0, 2));
  });
});

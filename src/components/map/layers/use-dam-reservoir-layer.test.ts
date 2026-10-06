import { expect, it } from "vitest";
import { reservoirPolygons } from "./use-dam-reservoir-layer";

it("omits unavailable polygons and keeps OSM holes within their own outer ring", () => {
  expect(reservoirPolygons(null).features).toEqual([]);
  const data = reservoirPolygons({ reservoir: [
    { role: "outer", coordinates: [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]] },
    { role: "inner", coordinates: [[1, 1], [2, 1], [2, 2], [1, 1]] },
    { role: "outer", coordinates: [[10, 10], [12, 10], [12, 12], [10, 10]] },
  ] });
  expect(data.features).toHaveLength(2);
  expect(data.features[0].geometry.coordinates).toHaveLength(2);
  expect(data.features[1].geometry.coordinates).toHaveLength(1);
});

import { expect, it } from "vitest";
import { surfaceWaterTileUrl } from "./surface-water";

it("builds the JRC occurrence tile URL in z/x/y order", () => {
  expect(surfaceWaterTileUrl({ z: 7, x: 101, y: 59 })).toBe(
    "https://storage.googleapis.com/global-surface-water/tiles2021/occurrence/7/101/59.png");
});

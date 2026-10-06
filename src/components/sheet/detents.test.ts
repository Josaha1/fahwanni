import { expect, it } from "vitest";
import { detentOffsets, nextDetent, snapDetent } from "./detents";

it("keeps the peek strip visible and snaps projected drags to three levels", () => {
  const offsets = detentOffsets(844);
  expect(offsets.peek).toBe(484);
  expect(offsets.full).toBeLessThan(offsets.half);
  expect(offsets.half).toBeLessThan(offsets.peek);
  expect(snapDetent(500, -1200, offsets)).toBe("half");
  expect(snapDetent(160, -1000, offsets)).toBe("full");
  expect(snapDetent(420, 1000, offsets)).toBe("peek");
  for (const [level, y] of Object.entries(offsets)) expect(snapDetent(y, 0, offsets)).toBe(level);
});
it("cycles keyboard/click levels and clamps short viewports", () => {
  expect(nextDetent("peek")).toBe("half");
  expect(nextDetent("half")).toBe("full");
  expect(nextDetent("full")).toBe("peek");
  const offsets = detentOffsets(240);
  expect(Object.values(offsets).every((value) => value >= 0 && value <= 240)).toBe(true);
});

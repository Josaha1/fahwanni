import { readFile, readdir } from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ringSprite, ringStep } from "./rings";

describe("ringStep", () => {
  it.each([[-10, 0], [0, 0], [4.99, 0], [5, 5], [79.99, 75], [80, 80], [99.99, 95], [100, 100], [119.99, 115], [120, 120], [999, 120]])(
    "clamps and rounds %s down to %s", (pct, step) => expect(ringStep(pct)).toBe(step),
  );

  it("selects roles before rounding and treats missing reports separately from zero", () => {
    expect(ringSprite(0)).toBe("ring-water-0");
    expect(ringSprite(80)).toBe("ring-water-80");
    expect(ringSprite(80.1)).toBe("ring-release-80");
    expect(ringSprite(100)).toBe("ring-release-100");
    expect(ringSprite(100.1)).toBe("ring-warn-100");
    expect(ringSprite(125)).toBe("ring-warn-120");
    for (const pct of [null, undefined, NaN, Infinity]) expect(ringSprite(pct)).toBe("ring-nodata");
  });
});

describe("generated ring sprites", () => {
  const directory = new URL("../../../public/map/rings/", import.meta.url);
  it("contains all 25 steps in each role plus nodata, at 2x with alpha", async () => {
    const names = ["ring-nodata.png", ...["water", "release", "warn"].flatMap((role) =>
      Array.from({ length: 25 }, (_, step) => `ring-${role}-${step * 5}.png`))];
    expect((await readdir(directory)).sort()).toEqual(names.sort());
    for (const name of names) {
      const metadata = await sharp(await readFile(new URL(name, directory))).metadata();
      expect([metadata.width, metadata.height, metadata.hasAlpha]).toEqual([80, 80, true]);
    }
  });

  it("starts at noon clockwise and reserves a thin outer arc for overflow", async () => {
    const pixel = async (name: string, x: number, y: number) => {
      const { data, info } = await sharp(await readFile(new URL(`${name}.png`, directory))).raw().toBuffer({ resolveWithObject: true });
      const offset = (y * info.width + x) * info.channels;
      return Array.from(data.subarray(offset, offset + info.channels));
    };
    expect(await pixel("ring-water-25", 62, 17)).toEqual([34, 211, 238, 255]);
    expect(await pixel("ring-water-25", 17, 17)).toEqual([51, 65, 85, 255]);
    expect(await pixel("ring-warn-100", 64, 10)).toEqual([0, 0, 0, 0]);
    expect((await pixel("ring-warn-120", 64, 10))[3]).toBeGreaterThan(0);
    expect(await pixel("ring-water-0", 40, 40)).toEqual([15, 23, 42, 255]);
  });
});

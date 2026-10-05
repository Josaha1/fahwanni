import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodePalettePng } from "./png";

// The decoder does not depend on CRCs; generated chunks isolate scanline/filter decoding.
function chunk(kind: string, data: Buffer) {
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  return Buffer.concat([length, Buffer.from(kind), data, Buffer.alloc(4)]);
}
function png(width: number, height: number, depth: number, raw: number[]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = depth; header[9] = 3;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header),
    chunk("PLTE", Buffer.from(Array.from({ length: 256 * 3 }, (_, i) => Math.floor(i / 3)))),
    chunk("IDAT", deflateSync(Buffer.from(raw))), chunk("IEND", Buffer.alloc(0))]);
}

describe("decodePalettePng", () => {
  it("decodes the fixture and preserves different transparent land and no-data colours", () => {
    const image = decodePalettePng(readFileSync(new URL("./fixture-flood-tile.png", import.meta.url)));
    expect([image.width, image.height, image.pixels.length]).toEqual([256, 256, 65536]);
    expect(image.palette.slice(0, 6)).toEqual([[0, 0, 0, 0], [0, 0, 1, 0], [50, 210, 245, 255],
      [255, 255, 0, 255], [250, 30, 36, 255], [175, 175, 175, 255]]);
    expect(new Set(image.pixels)).toEqual(new Set([1, 5]));
  });

  it("reconstructs all five PNG filters, including left/up edge cases", () => {
    const rows = [[10, 20, 30], [11, 23, 35], [13, 26, 39], [15, 29, 43], [17, 32, 47]];
    const raw: number[] = [];
    for (let y = 0; y < rows.length; y++) {
      raw.push(y);
      for (let x = 0; x < 3; x++) {
        const left = x ? rows[y][x - 1] : 0, up = y ? rows[y - 1][x] : 0;
        // This ramp makes the Paeth predictor choose up except at the first column.
        const predictor = y === 1 ? left : y === 2 ? up : y === 3 ? Math.floor((left + up) / 2) : y === 4 ? up : 0;
        raw.push((rows[y][x] - predictor + 256) % 256);
      }
    }
    expect([...decodePalettePng(png(3, 5, 8, raw)).pixels]).toEqual(rows.flat());
  });

  it.each([1, 2, 4])("unpacks %i-bit palette pixels", (depth) => {
    const width = 8 / depth;
    const image = decodePalettePng(png(width, 1, depth, [0, 0b10101010]));
    expect([...image.pixels]).toEqual(Array.from({ length: width }, (_, x) => (0b10101010 >> (8 - depth - x * depth)) & ((1 << depth) - 1)));
  });

  it("rejects truncated, non-PNG and unsupported images", () => {
    expect(() => decodePalettePng(Buffer.from("not a PNG"))).toThrow("signature");
    const valid = png(1, 1, 8, [0, 1]);
    expect(() => decodePalettePng(valid.subarray(0, 40))).toThrow();
    valid[25] = 6;
    expect(() => decodePalettePng(valid)).toThrow("Unsupported");
    expect(() => decodePalettePng(png(1, 1, 8, [5, 0]))).toThrow("filter");
  });
});

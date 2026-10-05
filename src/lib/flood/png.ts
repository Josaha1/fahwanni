import { inflateSync } from "node:zlib";

export type PalettePng = { width: number; height: number; pixels: Uint8Array; palette: Array<[number, number, number, number]> };

/** Preserve palette RGB even for transparent pixels: GIBS distinguishes dry land from no-data there. */
export function decodePalettePng(input: Uint8Array): PalettePng {
  const data = Buffer.from(input);
  if (!data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("Invalid PNG signature");
  let width = 0, height = 0, depth = 0, ended = false;
  let palette: PalettePng["palette"] = [];
  let alpha: Uint8Array = new Uint8Array();
  const chunks: Buffer[] = [];
  for (let offset = 8; offset + 12 <= data.length;) {
    const length = data.readUInt32BE(offset);
    if (offset + 12 + length > data.length) throw new Error("Truncated PNG chunk");
    const kind = data.toString("ascii", offset + 4, offset + 8);
    const chunk = data.subarray(offset + 8, offset + 8 + length);
    if (kind === "IHDR") {
      if (length !== 13) throw new Error("Invalid PNG header");
      width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4); depth = chunk[8];
      if (!width || !height || width * height > 4_194_304 || chunk[9] !== 3 || ![1, 2, 4, 8].includes(depth)
        || chunk[10] !== 0 || chunk[11] !== 0 || chunk[12] !== 0) throw new Error("Unsupported palette PNG");
    } else if (kind === "PLTE") {
      if (!length || length % 3 || length > 768) throw new Error("Invalid PNG palette");
      palette = Array.from({ length: length / 3 }, (_, i) => [chunk[i * 3], chunk[i * 3 + 1], chunk[i * 3 + 2], 255]);
    } else if (kind === "tRNS") alpha = chunk;
    else if (kind === "IDAT") chunks.push(chunk);
    else if (kind === "IEND") { ended = true; break; }
    offset += length + 12;
  }
  if (!ended || !width || !palette.length || !chunks.length) throw new Error("Incomplete PNG");
  palette.forEach((color, i) => { color[3] = alpha[i] ?? 255; });
  const stride = Math.ceil(width * depth / 8);
  const raw = inflateSync(Buffer.concat(chunks), { maxOutputLength: (stride + 1) * height });
  if (raw.length !== (stride + 1) * height) throw new Error("Invalid PNG scanlines");
  const bytes = new Uint8Array(stride * height);
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) throw new Error("Invalid PNG filter");
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x;
      const left = x ? bytes[at - 1] : 0, up = y ? bytes[at - stride] : 0, corner = x && y ? bytes[at - stride - 1] : 0;
      const p = left + up - corner;
      const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - corner);
      const predictor = filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2)
        : filter === 4 ? pa <= pb && pa <= pc ? left : pb <= pc ? up : corner : 0;
      bytes[at] = raw[y * (stride + 1) + x + 1] + predictor;
    }
    for (let x = 0; x < width; x++) {
      const index = (bytes[y * stride + Math.floor(x * depth / 8)] >> (8 - depth - (x * depth % 8))) & ((1 << depth) - 1);
      if (!palette[index]) throw new Error("Invalid PNG palette index");
      pixels[y * width + x] = index;
    }
  }
  return { width, height, pixels, palette };
}

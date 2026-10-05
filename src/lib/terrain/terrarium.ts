/** Mapzen Terrarium RGB encodes metres, including the fractional blue channel.
 * https://github.com/tilezen/joerd/blob/master/docs/formats.md#terrarium
 */
export function decodeTerrarium(red: number, green: number, blue: number): number {
  return red * 256 + green + blue / 256 - 32768;
}

export function terrariumTile(lat: number, lon: number, zoom = 12) {
  const n = 2 ** zoom;
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180;
  const tx = ((lon + 180) / 360 * n % n + n) % n;
  const ty = Math.min(n - Number.EPSILON * n, Math.max(0, (1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2 * n));
  const x = Math.floor(tx), y = Math.floor(ty);
  return { x, y, zoom, u: tx - x, v: ty - y,
    metres: 40_075_016.686 * Math.cos(latitude) / n,
    url: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png` };
}

/** Sample original encoded pixels before decoding; resizing RGB corrupts elevation. */
export function terrariumGrid(rgba: ArrayLike<number>, width: number, height: number, segments = 32) {
  if (width < 1 || height < 1 || rgba.length !== width * height * 4 || segments < 1) throw new Error("Invalid Terrarium pixels");
  return Array.from({ length: (segments + 1) ** 2 }, (_, index) => {
    const x = Math.round(index % (segments + 1) / segments * (width - 1));
    const y = Math.round(Math.floor(index / (segments + 1)) / segments * (height - 1));
    const offset = (y * width + x) * 4;
    if (!rgba[offset + 3] || rgba[offset] === 0) throw new Error("Missing Terrarium elevation");
    return decodeTerrarium(rgba[offset], rgba[offset + 1], rgba[offset + 2]);
  });
}

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

const circumferenceKm = 40_075.016686;
type Position = { lat: number; lon: number };
const mercatorY = (lat: number) => (1 - Math.asinh(Math.tan(Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180)) / Math.PI) / 2;

/** Local Mercator kilometres: shared by the DEM vertices and all geographical decals. */
export function terrainPosition(place: Position, point: Position) {
  const scale = circumferenceKm * Math.cos(place.lat * Math.PI / 180);
  const longitude = ((point.lon - place.lon + 540) % 360) - 180;
  return { x: longitude / 360 * scale, z: (mercatorY(point.lat) - mercatorY(place.lat)) * scale };
}

export function terrainCoordinate(place: Position, x: number, z: number): Position {
  const scale = circumferenceKm * Math.cos(place.lat * Math.PI / 180);
  return { lon: ((place.lon + x / scale * 360 + 540) % 360) - 180,
    lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * (mercatorY(place.lat) + z / scale)))) * 180 / Math.PI };
}

/** Choose the finest zoom covering the whole 60 km square in at most four tiles. */
export function terrariumArea(place: Position, radiusKm = 30) {
  for (let zoom = 12; zoom >= 0; zoom--) {
    const center = terrariumTile(place.lat, place.lon, zoom);
    const delta = radiusKm * 1000 / center.metres;
    const west = Math.floor(center.x + center.u - delta), east = Math.floor(center.x + center.u + delta);
    const north = Math.max(0, Math.floor(center.y + center.v - delta));
    const south = Math.min(2 ** zoom - 1, Math.floor(center.y + center.v + delta));
    if (east - west > 1 || south - north > 1) continue;
    const tiles = [];
    for (let y = north; y <= south; y++) for (let tx = west; tx <= east; tx++) {
      const x = (tx + 2 ** zoom) % 2 ** zoom;
      tiles.push({ x, y, zoom, url: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png` });
    }
    return tiles;
  }
  throw new Error("Invalid terrain area");
}

export type TerrainPixels = { x: number; y: number; zoom: number; width: number; height: number; rgba: ArrayLike<number> };

/** Match PlaneGeometry's two triangles so decals sit on the rendered DEM, not below it. */
export function terrainSurfaceHeight(heights: readonly number[], x: number, z: number, segments = 64, radiusKm = 30): number {
  const px = Math.max(0, Math.min(segments, (x / radiusKm + 1) / 2 * segments));
  const py = Math.max(0, Math.min(segments, (z / radiusKm + 1) / 2 * segments));
  const ix = Math.min(segments - 1, Math.floor(px)), iy = Math.min(segments - 1, Math.floor(py));
  const u = px - ix, v = py - iy, index = iy * (segments + 1) + ix;
  const a = heights[index], b = heights[index + segments + 1];
  const c = heights[index + segments + 2], d = heights[index + 1];
  return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v);
}

/** Decode each original pixel before interpolating heights, never interpolate encoded RGB. */
export function terrainElevation(tiles: readonly TerrainPixels[], point: Position): number {
  const at = terrariumTile(point.lat, point.lon, tiles[0]?.zoom);
  const tile = tiles.find((tile) => tile.x === at.x && tile.y === at.y);
  if (!tile) throw new Error("Missing Terrarium tile");
  const px = at.u * tile.width - 0.5, py = at.v * tile.height - 0.5;
  const x = Math.floor(px), y = Math.floor(py);
  const sample = (sx: number, sy: number) => {
    const offset = (Math.max(0, Math.min(tile.height - 1, sy)) * tile.width + Math.max(0, Math.min(tile.width - 1, sx))) * 4;
    if (!tile.rgba[offset + 3] || tile.rgba[offset] === 0) throw new Error("Missing Terrarium elevation");
    return decodeTerrarium(tile.rgba[offset], tile.rgba[offset + 1], tile.rgba[offset + 2]);
  };
  const u = px - x, v = py - y;
  return (sample(x, y) * (1 - u) + sample(x + 1, y) * u) * (1 - v)
    + (sample(x, y + 1) * (1 - u) + sample(x + 1, y + 1) * u) * v;
}

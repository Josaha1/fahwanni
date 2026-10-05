import {
  BufferGeometry, DataTexture, Float32BufferAttribute, LinearFilter, Path, RepeatWrapping,
  RGBFormat, Shape, ShapeGeometry, SRGBColorSpace,
} from "three";

export type Coordinate = readonly [number, number];
export type LocalPoint = readonly [number, number];
export type RegistryPoint = { lat: number; lon: number };
export type ReservoirRing = { role: string; coordinates: readonly Coordinate[] };
export interface DamGeometryData {
  footprint: readonly Coordinate[] | null;
  reservoir: readonly ReservoirRing[] | null;
  height: number | null;
  crestLength: number | null;
  damType: string | null;
}

/** x east, y up, z south; all scene geometry shares the registry origin. */
export function localMetres([lon, lat]: Coordinate, origin: RegistryPoint): LocalPoint {
  const radians = Math.PI / 180, radius = 6371008.8;
  return [(lon - origin.lon) * radians * radius * Math.cos(origin.lat * radians),
    -(lat - origin.lat) * radians * radius];
}

export function profileFor(damType: string | null) {
  const type = ["arch", "arch-gravity", "gravity", "earth", "rockfill"].includes(damType ?? "")
    ? damType! : "gravity";
  const fill = type === "earth" || type === "rockfill";
  return {
    type, estimated: type !== damType, curved: type === "arch" || type === "arch-gravity",
    upstreamSlope: fill ? 2.5 : type === "arch" ? 0 : 0.05,
    downstreamSlope: fill ? 2.5 : type === "arch" ? 0.1 : 0.75,
    material: { color: fill ? "#756957" : "#c5c7c9", roughness: fill ? 0.95 : 0.75 },
  };
}

export interface CrestSection {
  center: LocalPoint;
  /** Measured transverse footprint width (or symbolic crest width for a line). */
  width: number;
  crestWidth: number;
}
export interface DamGeometry {
  geometry: BufferGeometry | null;
  height: number | null;
  crest: CrestSection[];
  profile: ReturnType<typeof profileFor>;
  estimated: boolean;
  upstreamSign: number;
}

const same = (a: LocalPoint, b: LocalPoint) => a[0] === b[0] && a[1] === b[1];
const dot = (a: LocalPoint, b: LocalPoint) => a[0] * b[0] + a[1] * b[1];
const distance = (a: LocalPoint, b: LocalPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function polygonCrest(points: LocalPoint[]): CrestSection[] {
  const ring = points.slice(0, -1);
  const center = ring.reduce((sum, p) => [sum[0] + p[0] / ring.length, sum[1] + p[1] / ring.length], [0, 0]);
  let xx = 0, zz = 0, xz = 0;
  for (const p of ring) {
    const x = p[0] - center[0], z = p[1] - center[1];
    xx += x * x; zz += z * z; xz += x * z;
  }
  const angle = 0.5 * Math.atan2(2 * xz, xx - zz);
  const axis: LocalPoint = [Math.cos(angle), Math.sin(angle)], normal: LocalPoint = [-axis[1], axis[0]];
  const projected = ring.map((p) => [dot(p, axis), dot(p, normal)]);
  const min = Math.min(...projected.map((p) => p[0])), max = Math.max(...projected.map((p) => p[0]));
  const crest: CrestSection[] = [];
  // Transverse cuts follow the area centre, rather than sweeping around its closed perimeter.
  for (let i = 0; i <= 32; i++) {
    const along = min + (max - min) * (0.000001 + i / 32 * 0.999998);
    const hits: number[] = [];
    for (let j = 0; j < projected.length; j++) {
      const a = projected[j], b = projected[(j + 1) % projected.length];
      if ((a[0] <= along && along < b[0]) || (b[0] <= along && along < a[0])) {
        hits.push(a[1] + (b[1] - a[1]) * (along - a[0]) / (b[0] - a[0]));
      }
    }
    hits.sort((a, b) => a - b);
    // Concave areas can have separate intervals; keep the widest actual section, never bridge a gap.
    let low = 0, high = 0;
    for (let j = 0; j + 1 < hits.length; j += 2) {
      if (hits[j + 1] - hits[j] > high - low) { low = hits[j]; high = hits[j + 1]; }
    }
    if (high > low) {
      const across = (low + high) / 2;
      crest.push({ center: [axis[0] * along + normal[0] * across, axis[1] * along + normal[1] * across],
        width: high - low, crestWidth: high - low });
    }
  }
  return crest;
}

function normalAt(crest: readonly CrestSection[], index: number): LocalPoint {
  const a = crest[Math.max(0, index - 1)].center, b = crest[Math.min(crest.length - 1, index + 1)].center;
  const length = distance(a, b);
  return length ? [-(b[1] - a[1]) / length, (b[0] - a[0]) / length] : [0, 1];
}

/** Closed sweep with separate faces so the crest/face edges retain hard normals. */
function sweep(crest: readonly CrestSection[], sections: readonly (readonly LocalPoint[])[]): BufferGeometry {
  const positions: number[] = [], uvs: number[] = [];
  const add = (i: number, j: number): number[] => {
    const [offset, height] = sections[i][j], n = normalAt(crest, i), p = crest[i].center;
    return [p[0] + n[0] * offset, height, p[1] + n[1] * offset];
  };
  const triangle = (a: number[], b: number[], c: number[]) => {
    positions.push(...a, ...b, ...c);
    for (const p of [a, b, c]) uvs.push((p[0] + p[2]) / 20, p[1] / 20);
  };
  const count = sections[0]?.length ?? 0;
  for (let i = 0; i + 1 < crest.length; i++) {
    for (let j = 0; j < count; j++) {
      const k = (j + 1) % count;
      triangle(add(i, j), add(i + 1, j), add(i, k));
      triangle(add(i, k), add(i + 1, j), add(i + 1, k));
    }
  }
  for (let j = 1; j + 1 < count; j++) {
    triangle(add(0, 0), add(0, j), add(0, j + 1));
    triangle(add(crest.length - 1, 0), add(crest.length - 1, j + 1), add(crest.length - 1, j));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** Profiles are schematic, not surveyed face slopes. Caller owns geometry. */
export function extrudeFootprint(data: DamGeometryData, origin: RegistryPoint): DamGeometry {
  const profile = profileFor(data.damType);
  const points = (data.footprint ?? []).map((p) => localMetres(p, origin))
    .filter((p, i, all) => i === 0 || !same(p, all[i - 1]));
  const polygon = points.length >= 4 && same(points[0], points[points.length - 1]);
  let crest = polygon ? polygonCrest(points) : points.map((center) => ({ center, width: 8, crestWidth: 8 }));
  const fallback = crest.length < 2;
  if (fallback) {
    const length = data.crestLength ?? 300;
    crest = [{ center: [-length / 2, 0], width: 8, crestWidth: 8 }, { center: [length / 2, 0], width: 8, crestWidth: 8 }];
  }
  // An arch follows measured curvature. Other profiles use the area's longitudinal axis.
  if (polygon && !profile.curved) {
    const a = crest[0].center, b = crest[crest.length - 1].center;
    const width = crest.reduce((sum, section) => sum + section.width, 0) / crest.length;
    crest = [{ center: a, width, crestWidth: width }, { center: b, width, crestWidth: width }];
  }
  const middle = Math.floor(crest.length / 2), normal = normalAt(crest, middle);
  const water = (data.reservoir ?? []).filter((r) => r.role === "outer").flatMap((r) => r.coordinates);
  const side = water.reduce((sum, p) => {
    const local = localMetres(p, origin), center = crest[middle].center;
    return sum + dot([local[0] - center[0], local[1] - center[1]], normal);
  }, 0);
  const upstreamSign = side < 0 ? -1 : 1;
  // Missing height stays unknown, including for an estimated straight wall.
  const height = data.height;
  if (height !== null && (!Number.isFinite(height) || height <= 0)) throw new RangeError("Dam height must be positive or null");
  for (const section of crest) {
    // An area describes the body width. Deduct profile runs to find the crest; a narrow mapped
    // area needs a minimum crest and a schematic wider base to retain the requested face slopes.
    section.crestWidth = polygon && profile.type !== "arch" && height !== null
      ? Math.max(1, section.width - height * (profile.upstreamSlope + profile.downstreamSlope)) : section.width;
  }
  const sections = crest.map((section) => {
    const half = section.crestWidth / 2;
    // Negative offset is upstream; mirror the section when the reservoir is on the positive side.
    const shape: LocalPoint[] = [[-half - (height ?? 0) * profile.upstreamSlope, 0],
      [half + (height ?? 0) * profile.downstreamSlope, 0], [half, height ?? 0], [-half, height ?? 0]];
    return upstreamSign > 0 ? shape.map(([x, y]): LocalPoint => [-x, y]).reverse() : shape;
  });
  return { geometry: height === null ? null : sweep(crest, sections), height, crest, profile,
    estimated: fallback || profile.estimated, upstreamSign };
}

export function crestStrip(dam: DamGeometry) {
  if (dam.height === null) return null;
  const height = dam.height;
  const widths = dam.crest.map((s) => s.crestWidth);
  const road = sweep(dam.crest, widths.map((w) => [[-w / 2, height], [w / 2, height],
    [w / 2, height + 0.15], [-w / 2, height + 0.15]]));
  const parapets = [-1, 1].map((side) => sweep(dam.crest, widths.map((w) => {
    const edge = side * w / 2;
    return [[edge - 0.2, height + 0.15], [edge + 0.2, height + 0.15],
      [edge + 0.2, height + 1.15], [edge - 0.2, height + 1.15]];
  })));
  return { road, parapets };
}

/** Unit-size bays in a row; caller places/scales these symbols, never surveyed spillway geometry. */
export function gateBays(n: number) {
  if (!Number.isInteger(n) || n < 0) throw new RangeError("Gate count must be a non-negative integer");
  return { symbolic: true as const, bays: Array.from({ length: n }, (_, i) => {
    const x = i - (n - 1) / 2;
    return sweep([{ center: [x - 0.4, 0], width: 0.1, crestWidth: 0.1 }, { center: [x + 0.4, 0], width: 0.1, crestWidth: 0.1 }],
      [[[-0.05, 0], [0.05, 0], [0.05, 1], [-0.05, 1]], [[-0.05, 0], [0.05, 0], [0.05, 1], [-0.05, 1]]]);
  }) };
}

function inside(point: LocalPoint, ring: readonly LocalPoint[]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}

/** Full supplied shoreline at y=0, including islands; not a shoreline inferred from storage %. */
export function reservoirShape(rings: readonly ReservoirRing[] | null, origin: RegistryPoint): BufferGeometry | null {
  if (!rings) return null;
  const local = rings.map((ring) => ({ role: ring.role, points: ring.coordinates.map((p) => localMetres(p, origin)) }));
  const outer = local.filter((ring) => ring.role === "outer");
  if (!outer.length) return null;
  const shapes = outer.map((ring) => {
    const shape = new Shape();
    ring.points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
    return shape;
  });
  for (const hole of local.filter((ring) => ring.role === "inner")) {
    // Assign an island to the smallest containing outer, rather than cutting every disjoint reservoir.
    const candidates = outer.map((ring, index) => ({ ring, index, area: Math.abs(ring.points.reduce((sum, p, i) => {
      const next = ring.points[(i + 1) % ring.points.length];
      return sum + p[0] * next[1] - next[0] * p[1];
    }, 0)) })).filter(({ ring }) => hole.points.length && inside(hole.points[0], ring.points))
      .sort((a, b) => a.area - b.area);
    if (!candidates.length) continue;
    const path = new Path();
    hole.points.forEach(([x, z], i) => i ? path.lineTo(x, -z) : path.moveTo(x, -z));
    shapes[candidates[0].index].holes.push(path);
  }
  return new ShapeGeometry(shapes).rotateX(-Math.PI / 2);
}

/** CPU-only textures; caller owns and disposes both maps. */
export function concreteMaps(size: number) {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("Concrete map size must be a positive integer");
  const color = new Uint8Array(size * size * 3), roughness = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const joint = Math.min(u % 0.25, 0.25 - u % 0.25, v % 0.5, 0.5 - v % 0.5) < 0.008;
    const streak = (Math.sin(u * Math.PI * 32 + 0.4 * Math.sin(v * Math.PI * 2)) + 1) * 7;
    const grain = ((Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0) % 9;
    const shade = Math.round(202 - streak - grain - (joint ? 35 : 0));
    const offset = (y * size + x) * 3;
    color.set([shade, shade + 1, shade + 2], offset);
    roughness.fill(joint ? 225 : 190 + grain, offset, offset + 3);
  }
  const texture = (data: Uint8Array) => {
    const map = new DataTexture(data, size, size, RGBFormat);
    map.wrapS = map.wrapT = RepeatWrapping;
    map.minFilter = map.magFilter = LinearFilter;
    map.unpackAlignment = 1; map.needsUpdate = true;
    return map;
  };
  const map = texture(color), roughnessMap = texture(roughness);
  map.colorSpace = SRGBColorSpace;
  return { map, roughnessMap };
}

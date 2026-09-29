export type DamPath = {
  type: "Feature";
  properties: { damId: string; km: number };
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

export type Downstream = {
  km: number;
  stations: { code: string; km: number }[];
  provinces: { id: string; km: number }[];
};

type PathData = { paths: Map<string, DamPath>; downstream: Record<string, Downstream> };
let cached: Promise<PathData> | null = null;

export function loadDamPaths(): Promise<PathData> {
  if (!cached) cached = Promise.all([
    fetch("/data/dam-paths.geojson"),
    fetch("/data/dam-downstream.json"),
  ]).then(async ([pathsResponse, downstreamResponse]) => {
    if (!pathsResponse.ok || !downstreamResponse.ok) throw new Error("Dam paths unavailable");
    const paths = await pathsResponse.json() as { features: DamPath[] };
    const downstream = await downstreamResponse.json() as { dams: Record<string, Downstream> };
    return { paths: new Map(paths.features.map((feature) => [feature.properties.damId, feature])), downstream: downstream.dams };
  }).catch((error: unknown) => { cached = null; throw error; });
  return cached;
}

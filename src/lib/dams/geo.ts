type Point = [number, number];

const radians = (degrees: number) => degrees * Math.PI / 180;

function distanceKm(a: Point, b: Point): number {
  const lat = radians(b[1] - a[1]);
  const lon = radians(b[0] - a[0]);
  const sine = Math.sin(lat / 2) ** 2 +
    Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(lon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(sine));
}

// Kept in sync with scripts/dams/geo.mjs; the offline .mjs script cannot import TypeScript.
function projection(point: Point, start: Point, end: Point) {
  const scale = Math.cos(radians((point[1] + start[1] + end[1]) / 3));
  const dx = (end[0] - start[0]) * scale;
  const dy = end[1] - start[1];
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1,
    ((point[0] - start[0]) * scale * dx + (point[1] - start[1]) * dy) / length2));
  return { t, closest: [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t] as Point };
}

export function alongKm(point: Point, path: Point[]) {
  let traveled = 0;
  let best = { distanceKm: Infinity, km: 0 };
  for (let i = 1; i < path.length; i++) {
    const start = path[i - 1];
    const end = path[i];
    const segmentKm = distanceKm(start, end);
    const { t, closest } = projection(point, start, end);
    const distance = distanceKm(point, closest);
    if (distance < best.distanceKm) best = { distanceKm: distance, km: traveled + segmentKm * t };
    traveled += segmentKm;
  }
  return best;
}

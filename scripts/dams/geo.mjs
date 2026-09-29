const radians = (degrees) => degrees * Math.PI / 180;

export function distanceKm(a, b) {
  const lat = radians(b[1] - a[1]);
  const lon = radians(b[0] - a[0]);
  const sine = Math.sin(lat / 2) ** 2 +
    Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(lon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(sine));
}

function projection(point, start, end) {
  const scale = Math.cos(radians((point[1] + start[1] + end[1]) / 3));
  const dx = (end[0] - start[0]) * scale;
  const dy = end[1] - start[1];
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1,
    ((point[0] - start[0]) * scale * dx + (point[1] - start[1]) * dy) / length2));
  return { t, closest: [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t] };
}

export function pointToSegmentKm(point, start, end) {
  return distanceKm(point, projection(point, start, end).closest);
}

export function alongKm(point, path) {
  let traveled = 0;
  let best = { distanceKm: Infinity, km: 0, segmentIndex: 1, point: path[0] };
  for (let i = 1; i < path.length; i++) {
    const start = path[i - 1];
    const end = path[i];
    const segmentKm = distanceKm(start, end);
    const { t, closest } = projection(point, start, end);
    const distance = distanceKm(point, closest);
    if (distance < best.distanceKm) best = {
      distanceKm: distance, km: traveled + segmentKm * t, segmentIndex: i, point: closest,
    };
    traveled += segmentKm;
  }
  return best;
}

export function douglasPeucker(path, tolerance) {
  if (path.length <= 2) return path.slice();
  const kept = new Uint8Array(path.length);
  kept[0] = kept[path.length - 1] = 1;
  const stack = [[0, path.length - 1]];
  const tolerance2 = tolerance * tolerance;
  while (stack.length) {
    const [first, last] = stack.pop();
    const start = path[first];
    const end = path[last];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length2 = dx * dx + dy * dy;
    let farthest = -1;
    let maxDistance2 = tolerance2;
    for (let i = first + 1; i < last; i++) {
      const point = path[i];
      const t = length2 === 0 ? 0 : Math.max(0, Math.min(1,
        ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / length2));
      const x = point[0] - start[0] - t * dx;
      const y = point[1] - start[1] - t * dy;
      const distance2 = x * x + y * y;
      if (distance2 > maxDistance2) {
        maxDistance2 = distance2;
        farthest = i;
      }
    }
    if (farthest >= 0) {
      kept[farthest] = 1;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return path.filter((_, index) => kept[index]);
}

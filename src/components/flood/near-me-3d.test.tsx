import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NearMe3D, nearMeVisuals, type NearMeProps } from "./near-me-3d";
import { terrainPosition } from "@/lib/terrain/terrarium";

vi.mock("@/hooks/use-lite", () => ({ useLite: () => ({ lite: true, reducedMotion: false }) }));
const props: NearMeProps = { place: { lat: 13.7, lon: 100.5 }, counts: { flood: 7, recurringFlood: 2, dry: 10, water: 0, insufficientData: 350, noData: 6, sampled: 375 }, samples: [
  { lat: 13.71, lon: 100.52, kind: "flood" }, { lat: 13.68, lon: 100.48, kind: "insufficient-data" },
  { lat: 15, lon: 100.5, kind: "flood" },
], villages: [], station: { lat: 13.7, lon: 100.5, rainMm: 0 }, dam: { lat: 13.7, lon: 100.5, releaseCms: 2000 },
  summaries: ["Satellite sampling points, not area", "DDPM historical risk", "Rain 0 mm", "Release 2000 cms"] };

it("keeps satellite decals at their real coordinates and filters samples outside 30 km", () => {
  const data = nearMeVisuals(props);
  expect(data.state).toEqual({ flood: 9, insufficient: 356, villages: 0, rainMm: 0, releaseCms: 2000 });
  expect("points" in data.ring && data.ring.points).toHaveLength(2);
  if (!("points" in data.ring)) throw new Error("Missing points");
  const position = terrainPosition(props.place, data.ring.points[0]);
  expect(position.x).toBeCloseTo(2.163, 2);
  expect(position.z).toBeCloseTo(-1.113, 2);
  expect(terrainPosition(props.place, props.place)).toEqual({ x: 0, z: 0 });
  expect(data.release).toMatchObject({ value: 2000, ratio: 1, capped: true });
  expect(data.rain).toMatchObject({ unit: "mm", ratio: 0 });
});

it("renders four SVGs with the same nonempty summaries used for captions", () => {
  const html = renderToStaticMarkup(<NearMe3D {...props} />);
  expect(html.match(/role="img"/g)).toHaveLength(4);
  props.summaries.forEach((summary) => expect(html).toContain(`aria-label="${summary}"`));
  expect(html).toContain("pan-y");
  expect(html).toContain('&quot;mode&quot;:&quot;svg&quot;');
});

it("distinguishes unavailable observations from reported zero and caps village icons at twelve", () => {
  const missing = nearMeVisuals({ ...props, counts: null, samples: null, station: null, dam: null, villages: null });
  expect(missing.state.rainMm).toBeNull();
  expect(missing.gauge.state).toBe("no-data");
  const villages = Array.from({ length: 15 }, (_, i) => ({ id: String(i), lat: 13.7, lon: 100.5, level: 2 as const, village: "", tambon: "", amphoe: "", province: "" }));
  const html = renderToStaticMarkup(<NearMe3D {...props} villages={villages} />);
  expect(html.match(/fill="#eab308"/g)).toHaveLength(12);
  expect(html).toContain("+3");
});

it("places the labelled 35 and 90 mm ticks on the same scale as the fill", () => {
  for (const mm of [35, 90]) {
    const html = renderToStaticMarkup(<NearMe3D {...props} station={{ ...props.station!, rainMm: mm }} />);
    const gauge = nearMeVisuals({ ...props, station: { ...props.station!, rainMm: mm } }).gauge;
    if (gauge.state !== "data") throw new Error("Missing gauge");
    const y = 68 - gauge.ratio * 58;
    expect(html).toContain(`d="M98 ${y}h6"`);
    expect(html).toContain(`x="108" y="${y + 3}" fill="currentColor" font-size="10">${mm}</text>`);
    expect(html).toContain(`<rect x="67" y="${y}"`);
  }
});

it("uses counts even when there are no display samples", () => {
  const data = nearMeVisuals({ ...props, samples: [] });
  expect(data.state).toMatchObject({ flood: 9, insufficient: 356 });
  expect(data.ring).toMatchObject({ state: "data", points: [], flood: 9 });
  expect(nearMeVisuals({ ...props, counts: null }).ring.state).toBe("no-data");
});

import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const origin = "https://fahwanni.example";
const sandbox = { URL, self: {} as { fahRoute?: (request: Request, origin: string) => string | null; fahWarmable?: (url: string, origin: string) => boolean } };
runInNewContext(readFileSync(new URL("../../public/sw-routing.js", import.meta.url), "utf8"), sandbox);
const route = (path: string, options?: RequestInit) => sandbox.self.fahRoute!(new Request(new URL(path, origin), options), origin);

describe("service worker routing", () => {
  it.each([
    "/api/dams", "/api/flood-now", "/api/flood-now?lat=14.35&lon=100.57", "/api/flood-events", "/api/rain-risk", "/api/tmd-warnings", "/api/dams-trend", "/api/dams-history", "/api/rivers", "/api/tide",
    "/data/dam-paths.geojson", "/data/dam-downstream.json",
  ])("caches water data at %s", (path) => {
    expect(route(path)).toBe("data");
    expect(route(path, { method: "POST" })).toBeNull();
    expect(route(`https://other.example${path}`)).toBeNull();
  });

  it("leaves unrelated APIs uncached", () => {
    expect(route("/api/weather")).toBeNull();
    expect(route("/api/dams-extra")).toBeNull();
  });

  it("caches the map-first detail pages for offline navigation", () => {
    for (const path of ["/dam/200101", "/river/chao-phraya", "/province/phra-nakhon-si-ayutthaya", "/alerts"]) {
      expect(sandbox.self.fahRoute!({ method: "GET", url: `${origin}${path}`, mode: "navigate", headers: new Headers() } as Request, origin)).toBe("page");
    }
    expect(sandbox.self.fahRoute!({ method: "GET", url: `${origin}/dam/abc`, mode: "navigate", headers: new Headers() } as Request, origin)).toBeNull();
  });

  it("keeps page and static routing", () => {
    expect(sandbox.self.fahRoute!({ method: "GET", url: `${origin}/map`, mode: "navigate", headers: new Headers() } as Request, origin)).toBe("page");
    expect(sandbox.self.fahRoute!({ method: "GET", url: `${origin}/water`, mode: "navigate", headers: new Headers() } as Request, origin)).toBe("page");
    expect(route("/_next/static/chunk.js")).toBe("static");
    expect(route("/icon.png")).toBe("static");
    expect(sandbox.self.fahWarmable!("/_next/static/chunk.js", origin)).toBe(true);
    expect(sandbox.self.fahWarmable!("/api/dams", origin)).toBe(false);
  });
});

it.each([
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/9/398/235.png",
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS/default/2026-10-05/GoogleMapsCompatible_Level9/7/50/99.png",
  "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?REQUEST=GetMap",
])("routes terrain and GIBS tiles through cacheFirst: %s", (url) => {
  expect(route(url)).toBe("static");
  expect(route(url, { method: "POST" })).toBeNull();
});

it("does not cache unrelated AWS or GIBS resources", () => {
  expect(route("https://s3.amazonaws.com/other/image.png")).toBeNull();
  expect(route("https://gibs.earthdata.nasa.gov/colormaps/map.xml")).toBeNull();
});

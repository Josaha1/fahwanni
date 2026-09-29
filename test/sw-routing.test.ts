import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Req = { method: string; url: string; mode?: string; headers?: { get(name: string): string | null } };
const origin = "https://weather.example";
const scope: {
  fahRoute?: (r: Req, origin: string) => string | null;
  fahWarmable?: (url: string, origin: string) => boolean;
} = {};
new Function("self", readFileSync("public/sw-routing.js", "utf8"))(scope);
const route = (url: string, extra: Partial<Req> = {}) =>
  scope.fahRoute!({ method: "GET", url: new URL(url, origin).href, mode: "cors", headers: { get: () => null }, ...extra }, origin);

describe("service worker routing", () => {
  it("caches build assets, app icons, and the web manifest", () => {
    expect(route("/_next/static/chunks/app.js")).toBe("static");
    expect(route("/icon-192.png")).toBe("static");
    expect(route("/icon-512.png")).toBe("static");
    expect(route("/icon-maskable-512.png")).toBe("static");
    expect(route("/apple-touch-icon.png")).toBe("static");
    expect(route("/manifest.webmanifest")).toBe("static");
  });

  it("caches versioned MapLibre worker modules", () => {
    const worker = "/vendor/maplibre/6.11.2/maplibre-gl-worker.mjs";
    const shared = "/vendor/maplibre/6.11.2/maplibre-gl-shared.mjs";
    expect(route(worker)).toBe("static");
    expect(route(shared)).toBe("static");
    expect(scope.fahWarmable!(worker, origin)).toBe(true);
    expect(scope.fahWarmable!(shared, origin)).toBe(true);
    expect(route("/vendor/other/file.mjs")).toBeNull();
  });

  it("caches and warms both relief terrain images", () => {
    expect(route("/map/relief-light.webp")).toBe("static");
    expect(scope.fahWarmable!("/map/relief-light.webp", origin)).toBe(true);
    expect(route("/map/relief-dark.webp")).toBe("static");
    expect(scope.fahWarmable!("/map/relief-dark.webp", origin)).toBe(true);
    expect(route("/map/other.webp")).toBeNull();
  });

  it("caches the animated condition sprite sheets", () => {
    expect(route("/anim/rain-day.webp")).toBe("static");
    expect(route("/anim/clear-night.webp")).toBe("static");
    expect(scope.fahWarmable!("/anim/storm-day.webp", origin)).toBe(true);
    expect(route("/anim/../api/weather")).toBeNull();
    expect(route("/anim/readme.txt")).toBeNull();
  });

  it("caches the typhoon sprite", () => {
    expect(route("/anim/typhoon-calm.webp")).toBe("static");
    expect(scope.fahWarmable!("/anim/typhoon-calm.webp", origin)).toBe(true);
  });

  it("caches weather icons only from maps.gstatic.com", () => {
    expect(route("https://maps.gstatic.com/weather/v1/rain.svg")).toBe("static");
    expect(route("https://maps.gstatic.com/weather/v1/rain_dark.svg")).toBe("static");
    expect(route("https://maps.gstatic.com/other/rain.svg")).toBeNull();
    expect(route("https://other.gstatic.com/weather/v1/rain.svg")).toBeNull();
    expect(route("https://cdn.example.com/weather/v1/rain.svg")).toBeNull();
  });

  it("leaves the static JSON manifest to the network", () => {
    expect(route("/manifest.json")).toBeNull();
  });

  it("caches the satellite time manifest as data", () => {
    expect(route("/api/satellite")).toBe("data");
  });

  it("does not cache OpenFreeMap styles or tiles", () => {
    for (const url of [
      "https://tiles.openfreemap.org/styles/positron",
      "https://tiles.openfreemap.org/styles/dark",
      "https://tiles.openfreemap.org/planet/6/51/29.pbf",
    ]) {
      expect(route(url)).toBeNull();
      expect(scope.fahWarmable!(url, origin)).toBe(false);
    }
  });

  it("keeps offline copies of both pages only for full page loads", () => {
    expect(route("/", { mode: "navigate" })).toBe("page");
    expect(route("/map", { mode: "navigate" })).toBe("page");
    expect(route("/?_rsc=abc", { mode: "navigate" })).toBeNull();
    expect(route("/map?_rsc=abc", { mode: "navigate" })).toBeNull();
    expect(route("/", { mode: "navigate", headers: { get: (n) => (n === "RSC" ? "1" : null) } })).toBeNull();
    expect(route("/map", { mode: "navigate", headers: { get: (n) => (n === "RSC" ? "1" : null) } })).toBeNull();
    expect(route("/")).toBeNull();
    expect(route("/map")).toBeNull();
    expect(route("/settings", { mode: "navigate" })).toBeNull();
  });

  it("serves each page's own cached response when navigation is offline", async () => {
    type CachedResponse = { body: string; ok: boolean; redirected: boolean; type: string; clone: () => CachedResponse };
    const responses = new Map<string, CachedResponse>();
    const key = (request: string | Req) => new URL(typeof request === "string" ? request : request.url, origin).href;
    const cache = {
      put: async (request: Req, response: CachedResponse) => { responses.set(key(request), response); },
      match: async (request: Req) => responses.get(key(request)),
    };
    let offline = false;
    let fetchHandler: (event: { request: Req; respondWith: (response: Promise<CachedResponse>) => void }) => void = () => {};
    const worker = {
      fahRoute: scope.fahRoute,
      location: { origin },
      addEventListener: (name: string, handler: typeof fetchHandler) => { if (name === "fetch") fetchHandler = handler; },
    };
    new Function("self", "caches", "fetch", "importScripts", readFileSync("public/sw.js", "utf8"))(
      worker,
      { open: async () => cache },
      async (request: Req) => {
        if (offline) throw new Error("offline");
        const response: CachedResponse = { body: new URL(request.url).pathname, ok: true, redirected: false, type: "basic", clone() { return this; } };
        return response;
      },
      () => {},
    );
    const navigate = (path: string) => {
      let response: Promise<CachedResponse> | undefined;
      fetchHandler({
        request: { method: "GET", url: `${origin}${path}`, mode: "navigate", headers: { get: () => null } },
        respondWith: (result) => { response = result; },
      });
      return response!;
    };

    expect((await navigate("/")).body).toBe("/");
    expect((await navigate("/map")).body).toBe("/map");
    expect([...responses.keys()]).toEqual([`${origin}/`, `${origin}/map`]);
    offline = true;
    expect((await navigate("/map")).body).toBe("/map");
    expect((await navigate("/")).body).toBe("/");
  });

  it("never touches APIs, other pages, other origins or writes", () => {
    expect(route("/api/version")).toBeNull();
    expect(route("/api/weather?lat=13.75&lon=100.50")).toBeNull();
    expect(route("/api/geocode?q=Bangkok")).toBeNull();
    expect(route("/api/weather", { method: "POST" })).toBeNull();
    expect(route("/", { method: "POST", mode: "navigate" })).toBeNull();
    expect(route("https://cdn.example.com/_next/static/x.js")).toBeNull();
  });

  it("warms only static routes from resource URLs", () => {
    const warmable = (url: string) => scope.fahWarmable!(url, origin);
    expect(warmable(`${origin}/_next/static/chunks/app.js`)).toBe(true);
    expect(warmable(`${origin}/icon-192.png`)).toBe(true);
    expect(warmable(`${origin}/manifest.webmanifest`)).toBe(true);
    expect(warmable("https://maps.gstatic.com/weather/v1/rain.svg")).toBe(true);
    expect(warmable(`${origin}/`)).toBe(false);
    expect(warmable(`${origin}/map`)).toBe(false);
    expect(warmable(`${origin}/api/weather`)).toBe(false);
    expect(warmable("https://cdn.example.com/_next/static/x.js")).toBe(false);
    expect(warmable("https://maps.gstatic.com/other/rain.svg")).toBe(false);
    expect(warmable("http://[invalid")).toBe(false);
  });
});

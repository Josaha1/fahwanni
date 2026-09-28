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

  it("keeps an offline copy of the home page only for full page loads", () => {
    expect(route("/", { mode: "navigate" })).toBe("page");
    expect(route("/?_rsc=abc", { mode: "navigate" })).toBeNull();
    expect(route("/", { mode: "navigate", headers: { get: (n) => (n === "RSC" ? "1" : null) } })).toBeNull();
    expect(route("/")).toBeNull();
    expect(route("/settings", { mode: "navigate" })).toBeNull();
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
    expect(warmable(`${origin}/api/weather`)).toBe(false);
    expect(warmable("https://cdn.example.com/_next/static/x.js")).toBe(false);
    expect(warmable("https://maps.gstatic.com/other/rain.svg")).toBe(false);
    expect(warmable("http://[invalid")).toBe(false);
  });
});

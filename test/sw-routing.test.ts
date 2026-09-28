import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Req = { method: string; url: string; mode?: string; headers?: { get(name: string): string | null } };
const scope: { lookrakRoute?: (r: Req, origin: string) => string | null } = {};
new Function("self", readFileSync("public/sw-routing.js", "utf8"))(scope);
const route = (url: string, extra: Partial<Req> = {}) =>
  scope.lookrakRoute!({ method: "GET", url: `https://lookrak.app${url}`, mode: "cors", headers: { get: () => null }, ...extra }, "https://lookrak.app");

describe("service worker routing", () => {
  it("caches build assets and icons", () => {
    expect(route("/_next/static/chunks/app.js")).toBe("static");
    expect(route("/icon-192.png")).toBe("static");
    expect(route("/mascots/baby-face/icon-192.png")).toBe("static");
    expect(route("/mascots/baby-hello/apple-touch-icon.png")).toBe("static");
  });

  it("leaves both manifest URLs to the network", () => {
    expect(route("/manifest.json")).toBeNull();
    expect(route("/manifest.webmanifest")).toBeNull();
  });

  it("keeps an offline copy of the Today page only for full page loads", () => {
    expect(route("/app/today", { mode: "navigate" })).toBe("page");
    expect(route("/app/today?_rsc=abc", { mode: "navigate" })).toBeNull();
    expect(route("/app/today", { mode: "navigate", headers: { get: (n) => (n === "RSC" ? "1" : null) } })).toBeNull();
    expect(route("/app/today")).toBeNull();
    expect(route("/app/children", { mode: "navigate" })).toBeNull();
  });

  it("never touches APIs, other pages, other origins or writes", () => {
    expect(route("/api/version")).toBeNull();
    expect(route("/api/dose-events/action", { method: "POST" })).toBeNull();
    expect(route("/login", { mode: "navigate" })).toBeNull();
    expect(route("/app/today", { method: "POST", mode: "navigate" })).toBeNull();
    expect(scope.lookrakRoute!({ method: "GET", url: "https://cdn.example.com/_next/static/x.js" }, "https://lookrak.app")).toBeNull();
  });
});

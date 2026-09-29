import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const origin = "https://fahwanni.example";
const sandbox = { URL, self: {} as { fahRoute?: (request: Request, origin: string) => string | null; fahWarmable?: (url: string, origin: string) => boolean } };
runInNewContext(readFileSync(new URL("../../public/sw-routing.js", import.meta.url), "utf8"), sandbox);
const route = (path: string, options?: RequestInit) => sandbox.self.fahRoute!(new Request(new URL(path, origin), options), origin);

describe("service worker routing", () => {
  it.each([
    "/api/dams", "/api/rain-risk", "/api/tmd-warnings", "/api/dams-trend", "/api/dams-history", "/api/rivers",
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

  it("keeps page and static routing", () => {
    expect(sandbox.self.fahRoute!({ method: "GET", url: `${origin}/map`, mode: "navigate", headers: new Headers() } as Request, origin)).toBe("page");
    expect(route("/_next/static/chunk.js")).toBe("static");
    expect(route("/icon.png")).toBe("static");
    expect(sandbox.self.fahWarmable!("/_next/static/chunk.js", origin)).toBe(true);
    expect(sandbox.self.fahWarmable!("/api/dams", origin)).toBe(false);
  });
});

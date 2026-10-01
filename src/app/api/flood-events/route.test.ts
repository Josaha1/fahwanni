import { afterEach, expect, it, vi } from "vitest";
import fixture from "@/lib/water/fixture-flood-events.json";

vi.mock("next/server", () => ({ after: () => {} }));
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.resetModules(); });

it("merges GLIDE and GDACS and still answers when one source fails", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T03:00:00Z"));
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("gdacs") ? new Response(null, { status: 502 }) : Response.json(fixture.glide)));
  const response = await (await import("./route")).GET();
  expect(response.status).toBe(200);
  const payload = await response.json();
  expect(payload.sources).toEqual(["ADRC GLIDE via HDX (CC BY-IGO)"]);
  expect(payload.items.map((item: { id: string }) => item.id)).toEqual(["glide:FL-2026-000183-THA", "glide:FL-2026-000158-THA"]);
});

it("returns 503 no-store when both sources fail", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
  const response = await (await import("./route")).GET();
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});

it("treats a GDACS 204 (no events) as an empty source, not a failure", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T03:00:00Z"));
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("gdacs") ? new Response(null, { status: 204 }) : Response.json(fixture.glide)));
  const payload = await (await (await import("./route")).GET()).json();
  expect(payload.sources).toEqual(["GDACS (European Commission JRC / UN OCHA)", "ADRC GLIDE via HDX (CC BY-IGO)"]);
  expect(payload.items).toHaveLength(2);
});

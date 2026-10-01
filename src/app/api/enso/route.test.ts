import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";

const text = readFileSync(new URL("../../../lib/fixture-oni.txt", import.meta.url), "utf8");
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("serves the ENSO status and keeps it when NOAA fails", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(text)).mockResolvedValue(new Response(null, { status: 500 }));
  vi.stubGlobal("fetch", fetchMock);
  const { GET } = await import("./route");
  const first = await (await GET()).json();
  expect(first).toMatchObject({ phase: "el-nino", strength: "strong", officialEpisode: false });
  expect(fetchMock).toHaveBeenCalledOnce();
});

it("returns 503 when NOAA is down and nothing is cached", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
  expect((await (await import("./route")).GET()).status).toBe(503);
});

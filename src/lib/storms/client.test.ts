import { describe, expect, it, vi } from "vitest";
import targets from "./fixtures/jma-targetTc.json";
import forecast from "./fixtures/jma-forecast.json";
import specifications from "./fixtures/jma-specifications.json";
import gdacs from "./fixtures/gdacs-events.json";
import { fetchStorms } from "./client";

const now = new Date("2026-09-28T06:00:00Z");

describe("fetchStorms", () => {
  it("requests both sources and returns active false when neither has a storm in the bbox", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      urls.push(url);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Response.json(url.endsWith("targetTc.json") ? targets : url.endsWith("forecast.json") ? forecast :
        url.endsWith("specifications.json") ? specifications : gdacs);
    });
    const result = await fetchStorms(fetchImpl as typeof fetch, now);
    expect(result).toEqual({ active: false, storms: [], sources: { jma: "ok", gdacs: "ok" }, updatedAt: now.toISOString() });
    expect(urls).toHaveLength(4);
    expect(urls.find((url) => url.includes("geteventlist"))).toContain("fromDate=2026-09-18&toDate=2026-09-28");
  });

  it("keeps GDACS results if JMA fails", async () => {
    const recent = structuredClone(gdacs);
    recent.features[1].properties.todate = "2026-09-28T05:00:00";
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("jma.go.jp")) throw new Error("offline");
      return Response.json(recent);
    });
    const result = await fetchStorms(fetchImpl as typeof fetch, now);
    expect(result.active).toBe(true);
    expect(result.storms).toHaveLength(1);
    expect(result.sources).toEqual({ jma: "error", gdacs: "ok" });
  });
});

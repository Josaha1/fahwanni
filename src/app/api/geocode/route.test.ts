import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const request = (query: string) => new Request(`http://localhost/api/geocode?${query}`);

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/geocode", () => {
  it("rejects blank and overlong queries", async () => {
    for (const query of ["q=%20", `q=${"a".repeat(81)}`]) {
      expect((await GET(request(query))).status).toBe(400);
    }
  });

  it("places provinces first, requests eight Open-Meteo results, and deduplicates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [
      { id: 1, name: "Chiang Mai", latitude: 18.7877, longitude: 98.9931 },
      { id: 2, name: "Chiang Dao", admin1: "Chiang Mai", country: "Thailand", latitude: 19.365, longitude: 98.964 },
    ] }) });
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request("q=Chiang&lang=en"));
    const { results } = await response.json();
    expect(results[0].source).toBe("province");
    expect(results[0].country).toBe("Thailand");
    expect(results.some((p: { name: string }) => p.name === "Chiang Dao")).toBe(true);
    expect(results.filter((p: { name: string }) => p.name === "Chiang Mai")).toHaveLength(0);
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=86400");
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("count")).toBe("8");
    expect(url.searchParams.get("language")).toBe("en");
  });

  it("tries the district prefix before English and preserves province hits on failure", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request("q=เชียง&lang=th"));
    expect(response.status).toBe(200);
    const { results } = await response.json();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].country).toBe("ไทย");
    expect(fetchMock.mock.calls.map(([url]) => {
      const params = new URL(url).searchParams;
      return { name: params.get("name"), language: params.get("language") };
    })).toEqual([
      { name: "เชียง", language: "th" },
      { name: "อำเภอเชียง", language: "th" },
      { name: "เชียง", language: "en" },
    ]);
  });

  it("stops when the district-prefixed query returns results", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [
        { id: 1, name: "หัวหิน", admin1: "จังหวัดประจวบคีรีขันธ์", country: "Thailand", country_code: "TH", latitude: 12.57, longitude: 99.96 },
      ] }) });
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request("q=หัวหิน&lang=th"));
    const { results } = await response.json();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results[0]).toMatchObject({ name: "หัวหิน", admin: "ประจวบคีรีขันธ์" });
  });
});

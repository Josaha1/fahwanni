import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let GET: typeof import("./route").GET;

const request = (query: string) => new Request(`http://localhost/api/geocode?${query}`);

beforeEach(async () => {
  vi.resetModules();
  ({ GET } = await import("./route"));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("GET /api/geocode", () => {
  it("rejects blank and overlong queries", async () => {
    for (const query of ["q=%20", `q=${"a".repeat(81)}`]) {
      expect((await GET(request(query))).status).toBe(400);
    }
  });

  it("places provinces first, requests eight Open-Meteo results, and deduplicates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [
      { id: 1, name: "Chiang Mai", latitude: 18.7877, longitude: 98.9931 },
      { id: 2, country_code: "TH", name: "Chiang Dao", admin1: "Chiang Mai", country: "Thailand", latitude: 19.365, longitude: 98.964 },
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
    expect(url.searchParams.get("countryCode")).toBe("TH");
    expect(url.searchParams.get("language")).toBe("en");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ next: { revalidate: 86400 }, signal: expect.any(AbortSignal) });
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

  it("continues fallback when upstream returns only foreign matches", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [
        { id: 1, name: "Foreign", country_code: "ID", latitude: -1, longitude: 101 },
      ] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [
        { id: 2, name: "Thai district", country_code: "TH", latitude: 13, longitude: 100 },
      ] }) });
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request("q=foreign-unique&lang=th"));
    expect((await response.json()).results.map((place: { name: string }) => place.name)).toEqual(["Thai district"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  it("serves stale results during a 429 breaker, then retries after Retry-After", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [
        { id: 123, country_code: "TH", name: "Old City", latitude: 20, longitude: 99 },
      ] }) })
      .mockResolvedValueOnce({ ok: false, status: 429, headers: new Headers({ "Retry-After": "120" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [
        { id: 124, country_code: "TH", name: "New City", latitude: 21, longitude: 100 },
      ] }) });
    vi.stubGlobal("fetch", fetchMock);
    const query = "q=K4-unique-city&lang=en";
    const first = await GET(request(query));
    expect(first.headers.get("Cache-Control")).toBe("public, s-maxage=86400");

    vi.setSystemTime(24 * 60 * 60 * 1000);
    const stale = await GET(request(query));
    expect((await stale.json()).results[0].name).toBe("Old City");
    expect(stale.headers.get("x-geocode")).toBe("stale");
    expect(stale.headers.get("Cache-Control")).toBe("public, s-maxage=60");

    const blocked = await GET(request("q=K4-other-city&lang=en"));
    expect((await blocked.json()).results).toEqual([]);
    expect(blocked.headers.get("x-geocode")).toBe("degraded");
    expect(blocked.headers.get("Cache-Control")).toBe("public, s-maxage=60");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.setSystemTime(24 * 60 * 60 * 1000 + 120_000);
    const recovered = await GET(request(query));
    expect((await recovered.json()).results[0].name).toBe("New City");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

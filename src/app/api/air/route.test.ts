import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAir } from "@/lib/air-client";
import { WeatherError } from "@/lib/weather/client";
import { GET } from "./route";

vi.mock("@/lib/air-client", () => ({ fetchAir: vi.fn() }));

const request = (query: string) => new Request(`http://localhost/api/air?${query}`);

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(fetchAir).mockReset();
});

describe("GET /api/air", () => {
  it("validates coordinates and language", async () => {
    for (const query of ["lat=91&lon=100", "lat=13&lon=100&lang=fr", "lat=&lon=100"]) {
      const response = await GET(request(query));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "bad_request" });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
    expect(fetchAir).not.toHaveBeenCalled();
  });

  it("rounds coordinates and caches a successful response for 30 minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.mocked(fetchAir).mockResolvedValue({ pm25: 20 });
    const url = "lat=13.754&lon=100.504&lang=th";

    const first = await GET(request(url));
    expect(await first.json()).toEqual({ pm25: 20 });
    expect(first.headers.get("Cache-Control")).toBe("public, s-maxage=1800, stale-while-revalidate=3600");
    expect(fetchAir).toHaveBeenCalledWith(13.75, 100.5, "th");

    vi.setSystemTime(30 * 60 * 1000 - 1);
    await GET(request(url));
    expect(fetchAir).toHaveBeenCalledOnce();

    vi.setSystemTime(30 * 60 * 1000);
    await GET(request(url));
    expect(fetchAir).toHaveBeenCalledTimes(2);
  });

  it("returns stale data after an upstream failure", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.mocked(fetchAir).mockResolvedValueOnce({ pm25: 42 });
    await GET(request("lat=14&lon=101"));

    vi.setSystemTime(30 * 60 * 1000);
    vi.mocked(fetchAir).mockRejectedValueOnce(new WeatherError("quota"));
    const response = await GET(request("lat=14&lon=101"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pm25: 42 });
    expect(response.headers.get("X-Air-Stale")).toBe("1");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("uses the weather route error status mapping", async () => {
    vi.mocked(fetchAir).mockRejectedValueOnce(new WeatherError("no_key"))
      .mockRejectedValueOnce(new WeatherError("forbidden"));
    const missingKey = await GET(request("lat=15&lon=102"));
    expect(missingKey.status).toBe(503);
    expect(await missingKey.json()).toEqual({ error: "no_key" });
    const forbidden = await GET(request("lat=16&lon=103"));
    expect(forbidden.status).toBe(502);
    expect(await forbidden.json()).toEqual({ error: "forbidden" });
  });
});

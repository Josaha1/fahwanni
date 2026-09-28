import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixture.json";
import { fetchWeather, WeatherError } from "./client";

afterEach(() => vi.unstubAllEnvs());

function responseFor(path: string): Response {
  const body = path.includes("currentConditions") ? fixture.current
    : path.includes("forecast/hours") ? fixture.hours
    : path.includes("forecast/days") ? fixture.days
    : fixture.alerts;
  return Response.json(body);
}

describe("fetchWeather", () => {
  it("requests all four endpoints with the required parameters and normalizes responses", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    const urls: URL[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      urls.push(url);
      expect(init?.method).toBe("GET");
      expect(init?.cache).toBe("no-store");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return responseFor(url.pathname);
    });

    const snapshot = await fetchWeather(13.75, 100.5, "th", fetchImpl);

    expect(urls.map((url) => url.pathname)).toEqual([
      "/v1/currentConditions:lookup",
      "/v1/forecast/hours:lookup",
      "/v1/forecast/days:lookup",
      "/v1/publicAlerts:lookup",
    ]);
    for (const url of urls) {
      expect(url.origin).toBe("https://weather.googleapis.com");
      expect(url.searchParams.get("key")).toBe("test-key");
      expect(url.searchParams.get("location.latitude")).toBe("13.75");
      expect(url.searchParams.get("location.longitude")).toBe("100.5");
      expect(url.searchParams.get("languageCode")).toBe("th");
      expect(url.searchParams.get("unitsSystem")).toBe("METRIC");
    }
    expect(urls[1].searchParams.get("hours")).toBe("24");
    expect(urls[1].searchParams.get("pageSize")).toBe("24");
    expect(urls[2].searchParams.get("days")).toBe("10");
    expect(urls[2].searchParams.get("pageSize")).toBe("10");
    expect(snapshot).toMatchObject({ tempC: 33, hours: [{ tempC: 30 }], alerts: [{ id: "th-123" }] });
  });

  it("rejects a missing or empty key before requesting", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "  ");
    const fetchImpl = vi.fn();

    await expect(fetchWeather(13.75, 100.5, "en", fetchImpl)).rejects.toMatchObject({ code: "no_key" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [403, "forbidden"],
    [429, "quota"],
    [500, "upstream"],
  ] as const)("maps a %i response to %s", async (status, code) => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("currentConditions") ? new Response(null, { status }) : responseFor(new URL(String(input)).pathname));

    await expect(fetchWeather(13.75, 100.5, "th", fetchImpl)).rejects.toMatchObject({ code });
  });

  it("maps a timed-out request to timeout", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    const fetchImpl = vi.fn(async () => { throw new DOMException("request timed out", "TimeoutError"); });

    await expect(fetchWeather(13.75, 100.5, "th", fetchImpl)).rejects.toMatchObject({ code: "timeout" });
  });

  it("treats an alerts 404 as empty alerts while keeping the other data", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      return path.includes("publicAlerts") ? new Response(null, { status: 404 }) : responseFor(path);
    });

    await expect(fetchWeather(13.75, 100.5, "th", fetchImpl)).resolves.toMatchObject({
      tempC: 33,
      alerts: [],
    });
  });

  it("treats an alerts network failure as empty alerts while keeping the other data", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path.includes("publicAlerts")) throw new TypeError("Failed to fetch");
      return responseFor(path);
    });

    await expect(fetchWeather(13.75, 100.5, "th", fetchImpl)).resolves.toMatchObject({
      tempC: 33,
      alerts: [],
    });
  });

  it("treats malformed alerts as empty alerts while keeping the other data", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      return path.includes("publicAlerts") ? Response.json({ weatherAlerts: "x" }) : responseFor(path);
    });

    await expect(fetchWeather(13.75, 100.5, "th", fetchImpl)).resolves.toMatchObject({
      tempC: 33,
      alerts: [],
    });
  });

  it("never includes the key in errors from the upstream fetch", async () => {
    const key = "secret-test-key";
    vi.stubEnv("GOOGLE_MAPS_API_KEY", key);
    const fetchImpl = vi.fn(async () => { throw new Error(`request failed for ${key}`); });

    const error = await fetchWeather(13.75, 100.5, "th", fetchImpl).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(WeatherError);
    expect(error).toMatchObject({ code: "upstream" });
    expect((error as Error).message).not.toContain(key);
  });
});

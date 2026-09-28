import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeAir, pm25Level } from "./air";
import { fetchAir } from "./air-client";
import { WeatherCache } from "./weather/cache";
import { WeatherError } from "./weather/client";

const fixture = {
  dateTime: "2026-09-28T08:00:00Z",
  regionCode: "th",
  indexes: [
    { code: "uaqi", aqi: 53, category: "Moderate", displayName: "Universal AQI" },
    { code: "tha", aqi: 41, category: "ปานกลาง" },
  ],
  pollutants: [
    { code: "pm25", concentration: { value: 20.5, units: "MICROGRAMS_PER_CUBIC_METER" } },
    { code: "pm10", concentration: { value: 35, units: "MICROGRAMS_PER_CUBIC_METER" } },
  ],
};

afterEach(() => vi.unstubAllEnvs());

describe("air response normalization", () => {
  it("extracts PM concentrations, universal AQI and local AQI", () => {
    expect(normalizeAir(fixture)).toEqual({
      pm25: 20.5,
      pm10: 35,
      aqi: 53,
      aqiCategory: "Moderate",
      localAqi: { code: "tha", aqi: 41, category: "ปานกลาง" },
      dateTime: "2026-09-28T08:00:00Z",
    });
  });

  it("ignores PM2.5 in ppb", () => {
    expect(normalizeAir({ pollutants: [
      { code: "pm25", concentration: { value: 30, units: "PARTS_PER_BILLION" } },
    ] }).pm25).toBeUndefined();
  });

  it("accepts missing pollutants and indexes", () => {
    expect(normalizeAir({})).toEqual({
      pm25: undefined,
      pm10: undefined,
      aqi: undefined,
      aqiCategory: undefined,
      localAqi: undefined,
      dateTime: undefined,
    });
  });
});

describe("Thai PM2.5 levels", () => {
  it.each([
    [0, "very-good"],
    [15, "very-good"],
    [15.1, "good"],
    [25, "good"],
    [25.1, "moderate"],
    [37.5, "moderate"],
    [37.6, "starting-to-affect"],
    [75, "starting-to-affect"],
    [75.1, "affects-health"],
  ] as const)("maps %s µg/m³ to %s", (value, level) => {
    expect(pm25Level(value)).toBe(level);
  });
});

describe("fetchAir", () => {
  it("posts the documented payload and normalizes the response", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://airquality.googleapis.com");
      expect(url.pathname).toBe("/v1/currentConditions:lookup");
      expect(url.searchParams.get("key")).toBe("test-key");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ "Content-Type": "application/json" });
      expect(init?.cache).toBe("no-store");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(JSON.parse(String(init?.body))).toEqual({
        location: { latitude: 13.75, longitude: 100.5 },
        universalAqi: true,
        extraComputations: ["LOCAL_AQI", "POLLUTANT_CONCENTRATION"],
        languageCode: "th",
      });
      return Response.json(fixture);
    });

    await expect(fetchAir(13.75, 100.5, "th", fetchImpl)).resolves.toMatchObject({ pm25: 20.5, aqi: 53 });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects a missing key before requesting", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", " ");
    const fetchImpl = vi.fn();
    await expect(fetchAir(13.75, 100.5, "en", fetchImpl)).rejects.toMatchObject({ code: "no_key" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([[403, "forbidden"], [429, "quota"], [500, "upstream"]] as const)(
    "maps HTTP %i to %s", async (status, code) => {
      vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
      await expect(fetchAir(13.75, 100.5, "th", async () => new Response(null, { status })))
        .rejects.toMatchObject({ code });
    },
  );

  it("maps timeout and hides the key in other errors", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "secret-test-key");
    await expect(fetchAir(13.75, 100.5, "th", async () => {
      throw new DOMException("timed out", "TimeoutError");
    })).rejects.toMatchObject({ code: "timeout" });
    const error = await fetchAir(13.75, 100.5, "th", async () => {
      throw new Error("secret-test-key");
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(WeatherError);
    expect((error as Error).message).not.toContain("secret-test-key");
  });
});

it("keeps air fresh for 30 minutes while weather keeps its default 10 minutes", () => {
  let now = 0;
  const air = new WeatherCache<ReturnType<typeof normalizeAir>>(() => now, 200, 30 * 60 * 1000);
  const value = normalizeAir(fixture);
  air.set("bangkok", value);
  now = 30 * 60 * 1000 - 1;
  expect(air.getFresh("bangkok")).toBe(value);
  now += 1;
  expect(air.getFresh("bangkok")).toBeUndefined();
  expect(air.getStale("bangkok")).toBe(value);
});

import { describe, expect, it } from "vitest";
import { goldenHours, moonLitFraction, nextEclipses, planetsAt, stargazing, sunsetAfter } from "./astro";
import { nextMeteorShower } from "./meteors";

const BKK = { lat: 13.75, lon: 100.5 };
const day = Date.parse("2026-10-01T00:00:00+07:00");

describe("night sky", () => {
  it("orders blue → golden in the morning and golden → blue in the evening around Bangkok's sunset (~18:07)", () => {
    const hours = goldenHours(BKK.lat, BKK.lon, day);
    expect(hours.morningBlue![1]).toBe(hours.morningGolden![0]);
    expect(hours.eveningGolden![1]).toBe(hours.eveningBlue![0]);
    const sunset = sunsetAfter(BKK.lat, BKK.lon, day)!;
    expect(sunset > hours.eveningGolden![0] && sunset < hours.eveningGolden![1]).toBe(true);
    expect(new Date(sunset).toISOString()).toMatch(/^2026-10-01T11:0\d/);
  });

  it("lists planets 10° up an hour after sunset, brightest first (Saturn tonight)", () => {
    const planets = planetsAt(BKK.lat, BKK.lon, Date.parse("2026-10-01T20:00:00+07:00"));
    expect(planets.map((planet) => planet.body)).toContain("Saturn");
    expect(planets.every((planet) => planet.altitude >= 10)).toBe(true);
  });

  it("finds the next eclipse visible from Bangkok and skips penumbral lunar ones", () => {
    const eclipses = nextEclipses(BKK.lat, BKK.lon, day);
    expect(eclipses.length).toBeGreaterThan(0);
    expect(eclipses.find((eclipse) => eclipse.type === "solar")?.peak.slice(0, 10)).toBe("2027-08-02");
    expect(eclipses.every((eclipse) => eclipse.kind !== "penumbral")).toBe(true);
  });

  it("judges stargazing from hourly conditions and the moon", () => {
    const sunset = "2026-10-01T11:07:00Z";
    const hours = Array.from({ length: 10 }, (_, i) => ({ startTime: new Date(Date.parse("2026-10-01T11:00:00Z") + i * 3_600_000).toISOString(),
      conditionType: i < 6 ? "MOSTLY_CLEAR" : "CLOUDY", rainChance: 10 }));
    // window = sunset−1 h … 02:00 local → 8 hours, 6 of them clear
    expect(stargazing(hours, sunset, 0.2)).toEqual({ verdict: "good", clearShare: 0.75 });
    expect(stargazing(hours, sunset, 0.9)?.verdict).toBe("fair");
    expect(stargazing(hours.map((hour) => ({ ...hour, conditionType: "THUNDERSTORM" })), sunset, 0)?.verdict).toBe("poor");
    expect(stargazing(hours.slice(0, 2), sunset, 0)).toBeNull();
    expect(moonLitFraction(Date.parse("2026-10-01T13:00:00Z"))).toBeCloseTo(0.73, 1);
  });

  it("finds the next meteor shower within 30 days", () => {
    expect(nextMeteorShower("2026-10-01")).toMatchObject({ shower: { id: "orionids" }, peak: "2026-10-21", daysAway: 20 });
    expect(nextMeteorShower("2026-12-30")).toMatchObject({ shower: { id: "quadrantids" }, peak: "2027-01-03", daysAway: 4 });
    expect(nextMeteorShower("2026-06-01")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import fixture from "./fixture.json";
import { normalize } from "./normalize";
import { currentConditionsSchema, forecastDaysSchema, forecastHoursSchema, publicAlertsSchema } from "./schema";

function parsedFixture() {
  return {
    current: currentConditionsSchema.parse(fixture.current),
    hours: forecastHoursSchema.parse(fixture.hours),
    days: forecastDaysSchema.parse(fixture.days),
    alerts: publicAlertsSchema.parse(fixture.alerts),
  };
}

describe("weather response normalization", () => {
  it("parses REST-shaped responses and converts values to metric", () => {
    const { current, hours, days, alerts } = parsedFixture();
    expect("futureField" in current).toBe(false);

    const snapshot = normalize(current, hours, days, alerts);
    expect(snapshot).toMatchObject({
      tempC: 33,
      feelsLikeC: 39,
      heatIndexC: 42,
      humidity: 72,
      uvIndex: 8,
      rainChance: 60,
      rainMm: 3.5,
      thunderChance: 55,
      windKmh: 18,
      gustKmh: 43,
      windDir: "SW",
      conditionType: "PARTLY_CLOUDY",
      iconBaseUri: "https://maps.gstatic.com/weather/v1/partly_cloudy",
      description: "เมฆบางส่วน",
      isDaytime: true,
      timeZone: "Asia/Bangkok",
      fetchedAt: "2026-09-28T08:00:00Z",
    });
    expect(snapshot.hours[0]).toMatchObject({
      startTime: "2026-09-28T09:00:00Z",
      tempC: 30,
      rainChance: 80,
      rainMm: 12.7,
      conditionType: "RAIN",
    });
    expect(snapshot.hours[0].windKmh).toBeCloseTo(16.09344);
    expect(snapshot.days[0]).toMatchObject({
      date: "2026-09-28",
      maxTempC: 35,
      minTempC: 27,
      feelsLikeMaxC: 41,
      feelsLikeMinC: 29,
      maxHeatIndexC: 43,
      sunrise: "2026-09-28T05:59:00+07:00",
      sunset: "2026-09-28T18:04:00+07:00",
      day: { rainChance: 70, rainMm: 12, uvIndex: 7 },
      night: { rainChance: 20, conditionType: "CLOUDY" },
    });
    expect(snapshot.alerts[0]).toMatchObject({
      id: "th-123",
      title: "ฝนตกหนัก",
      instructions: ["หลีกเลี่ยงพื้นที่น้ำท่วม"],
      severity: "SEVERE",
    });
  });

  it("accepts omitted fields and an empty alerts response", () => {
    const current = currentConditionsSchema.parse({});
    const hours = forecastHoursSchema.parse({ forecastHours: [{}] });
    const days = forecastDaysSchema.parse({ forecastDays: [{ daytimeForecast: {} }] });
    const alerts = publicAlertsSchema.parse({});

    expect(normalize(current, hours, days, alerts)).toMatchObject({
      hours: [{ tempC: undefined }],
      days: [{ day: {}, night: {} }],
      alerts: [],
    });
  });

  it("treats omitted units as metric", () => {
    const current = currentConditionsSchema.parse({
      temperature: { degrees: 31 },
      precipitation: { qpf: { quantity: 4 } },
      wind: { speed: { value: 18 } },
    });

    expect(normalize(current, forecastHoursSchema.parse({}), forecastDaysSchema.parse({}), publicAlertsSchema.parse({})))
      .toMatchObject({ tempC: 31, rainMm: 4, windKmh: 18 });
  });

  it("keeps snow probability out of rain chance and returns the same result for the same inputs", () => {
    const { current, hours, days, alerts } = parsedFixture();
    current.precipitation = { probability: { percent: 80, type: "SNOW" } };
    const first = normalize(current, hours, days, alerts);
    expect(first.rainChance).toBeUndefined();
    expect(normalize(current, hours, days, alerts)).toEqual(first);
  });
});

describe("moon events", () => {
  it("passes the moon phase and first rise/set times through", () => {
    const { current, hours, days, alerts } = parsedFixture();
    const [day] = normalize(current, hours, days, alerts).days;
    expect(day.moonPhase).toBe("FULL_MOON");
    expect(day.moonrise).toBe("2026-09-28T18:30:00+07:00");
    expect(day.moonset).toBeUndefined();
  });
});

import type { CurrentConditions, ForecastDays, ForecastHours, PublicAlerts } from "./schema";
import type { WeatherMetrics, WeatherSnapshot } from "./types";

type Conditions = NonNullable<ForecastHours["forecastHours"]>[number];

function celsius(value?: { degrees?: number; unit?: "CELSIUS" | "FAHRENHEIT" }): number | undefined {
  if (value?.degrees === undefined) return undefined;
  if (value.unit === undefined || value.unit === "CELSIUS") return value.degrees;
  if (value.unit === "FAHRENHEIT") return (value.degrees - 32) * 5 / 9;
  return undefined;
}

function millimeters(value?: { quantity?: number; unit?: string }): number | undefined {
  if (value?.quantity === undefined) return undefined;
  if (value.unit === undefined || value.unit === "MILLIMETERS") return value.quantity;
  if (value.unit === "INCHES") return value.quantity * 25.4;
  return undefined;
}

function kilometersPerHour(value?: { value?: number; unit?: string }): number | undefined {
  if (value?.value === undefined) return undefined;
  if (value.unit === undefined || value.unit === "KILOMETERS_PER_HOUR") return value.value;
  if (value.unit === "MILES_PER_HOUR") return value.value * 1.609344;
  return undefined;
}

function metrics(input: Conditions | CurrentConditions): WeatherMetrics {
  const chance = input.precipitation?.probability;
  return {
    tempC: celsius(input.temperature),
    feelsLikeC: celsius(input.feelsLikeTemperature),
    heatIndexC: celsius(input.heatIndex),
    humidity: input.relativeHumidity,
    uvIndex: input.uvIndex,
    rainChance: chance?.type === "SNOW" ? undefined : chance?.percent,
    rainMm: millimeters(input.precipitation?.qpf),
    thunderChance: input.thunderstormProbability,
    windKmh: kilometersPerHour(input.wind?.speed),
    gustKmh: kilometersPerHour(input.wind?.gust),
    windDir: input.wind?.direction?.cardinal,
    conditionType: input.weatherCondition?.type,
    iconBaseUri: input.weatherCondition?.iconBaseUri,
    description: input.weatherCondition?.description?.text,
    isDaytime: input.isDaytime,
  };
}

function dateString(date?: { year?: number; month?: number; day?: number }): string | undefined {
  if (date?.year === undefined || date.month === undefined || date.day === undefined) return undefined;
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function normalize(
  current: CurrentConditions,
  hours: ForecastHours,
  days: ForecastDays,
  alerts: PublicAlerts,
): WeatherSnapshot {
  return {
    ...metrics(current),
    hours: (hours.forecastHours ?? []).map((hour) => ({
      ...metrics(hour),
      startTime: hour.interval?.startTime,
      endTime: hour.interval?.endTime,
    })),
    days: (days.forecastDays ?? []).map((day) => ({
      date: dateString(day.displayDate),
      startTime: day.interval?.startTime,
      endTime: day.interval?.endTime,
      maxTempC: celsius(day.maxTemperature),
      minTempC: celsius(day.minTemperature),
      feelsLikeMaxC: celsius(day.feelsLikeMaxTemperature),
      feelsLikeMinC: celsius(day.feelsLikeMinTemperature),
      maxHeatIndexC: celsius(day.maxHeatIndex),
      day: {
        ...metrics(day.daytimeForecast ?? {}),
        startTime: day.daytimeForecast?.interval?.startTime,
        endTime: day.daytimeForecast?.interval?.endTime,
      },
      night: {
        ...metrics(day.nighttimeForecast ?? {}),
        startTime: day.nighttimeForecast?.interval?.startTime,
        endTime: day.nighttimeForecast?.interval?.endTime,
      },
      sunrise: day.sunEvents?.sunriseTime,
      sunset: day.sunEvents?.sunsetTime,
      moonPhase: day.moonEvents?.moonPhase,
      moonrise: day.moonEvents?.moonriseTimes?.[0],
      moonset: day.moonEvents?.moonsetTimes?.[0],
    })),
    alerts: (alerts.weatherAlerts ?? []).map((alert) => ({
      id: alert.alertId,
      title: alert.alertTitle?.text,
      eventType: alert.eventType,
      areaName: alert.areaName,
      instructions: alert.instruction ?? [],
      safetyRecommendations: alert.safetyRecommendations ?? [],
      startTime: alert.startTime,
      expirationTime: alert.expirationTime,
      description: alert.description,
      severity: alert.severity,
      certainty: alert.certainty,
      urgency: alert.urgency,
    })),
    timeZone: current.timeZone?.id ?? hours.timeZone?.id ?? days.timeZone?.id,
    fetchedAt: current.currentTime,
  };
}

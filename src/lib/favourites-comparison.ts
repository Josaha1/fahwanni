import type { WeatherCacheEntry } from "./weather-cache-client";
import type { WeatherSnapshot } from "./weather/types";

export function comparisonValues(snapshot?: WeatherSnapshot, air?: WeatherCacheEntry["air"]) {
  const today = snapshot?.days[0];
  const chances = [today?.day.rainChance, today?.night.rainChance]
    .filter((chance): chance is number => chance !== undefined && Number.isFinite(chance));
  return {
    tempC: snapshot?.tempC !== undefined && Number.isFinite(snapshot.tempC) ? Math.round(snapshot.tempC) : null,
    rainChance: chances.length ? Math.round(Math.max(...chances))
      : snapshot?.rainChance !== undefined && Number.isFinite(snapshot.rainChance) ? Math.round(snapshot.rainChance) : null,
    pm25: air?.pm25 !== undefined && Number.isFinite(air.pm25) ? Math.round(air.pm25 * 10) / 10 : null,
  };
}

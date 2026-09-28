import { describe, expect, it } from "vitest";
import { conditionTable, describeCondition, iconUrl } from "./condition";

const weatherConditionTypes = [
  "CLEAR", "MOSTLY_CLEAR", "PARTLY_CLOUDY", "MOSTLY_CLOUDY", "CLOUDY", "WINDY", "WIND_AND_RAIN",
  "LIGHT_RAIN_SHOWERS", "CHANCE_OF_SHOWERS", "SCATTERED_SHOWERS", "RAIN_SHOWERS", "HEAVY_RAIN_SHOWERS",
  "LIGHT_TO_MODERATE_RAIN", "MODERATE_TO_HEAVY_RAIN", "RAIN", "LIGHT_RAIN", "HEAVY_RAIN",
  "RAIN_PERIODICALLY_HEAVY", "LIGHT_SNOW_SHOWERS", "CHANCE_OF_SNOW_SHOWERS", "SCATTERED_SNOW_SHOWERS",
  "SNOW_SHOWERS", "HEAVY_SNOW_SHOWERS", "LIGHT_TO_MODERATE_SNOW", "MODERATE_TO_HEAVY_SNOW", "SNOW",
  "LIGHT_SNOW", "HEAVY_SNOW", "SNOWSTORM", "SNOW_PERIODICALLY_HEAVY", "HEAVY_SNOW_STORM",
  "BLOWING_SNOW", "RAIN_AND_SNOW", "HAIL", "HAIL_SHOWERS", "THUNDERSTORM", "THUNDERSHOWER",
  "LIGHT_THUNDERSTORM_RAIN", "SCATTERED_THUNDERSTORMS", "HEAVY_THUNDERSTORM", "TYPE_UNSPECIFIED",
];

describe("describeCondition", () => {
  it("has Thai, English, and a valid group for every weather condition type", () => {
    const validGroups = ["clear", "cloud", "rain", "storm", "snow", "wind", "hail"];

    expect(Object.keys(conditionTable).sort()).toEqual([...weatherConditionTypes].sort());
    for (const type of weatherConditionTypes) {
      const condition = describeCondition(type);
      expect(condition.th.trim(), type).not.toBe("");
      expect(condition.en.trim(), type).not.toBe("");
      expect(validGroups, type).toContain(condition.group);
    }
  });

  it("uses TYPE_UNSPECIFIED for unknown or missing types", () => {
    expect(describeCondition("UNKNOWN")).toEqual(conditionTable.TYPE_UNSPECIFIED);
    expect(describeCondition()).toEqual(conditionTable.TYPE_UNSPECIFIED);
  });
});

describe("iconUrl", () => {
  it("uses the light and dark SVG variants", () => {
    const base = "https://maps.gstatic.com/weather/v1/partly_cloudy";
    expect(iconUrl(base, false)).toBe(`${base}.svg`);
    expect(iconUrl(base, true)).toBe(`${base}_dark.svg`);
  });
});

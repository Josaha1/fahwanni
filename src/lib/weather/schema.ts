import { z } from "zod";

const temperatureSchema = z.object({
  degrees: z.number().optional(),
  unit: z.enum(["CELSIUS", "FAHRENHEIT"]).optional(),
});

const intervalSchema = z.object({
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

const timeZoneSchema = z.object({
  id: z.string().optional(),
  version: z.string().optional(),
});

const weatherConditionSchema = z.object({
  iconBaseUri: z.string().optional(),
  description: z.object({ text: z.string().optional(), languageCode: z.string().optional() }).optional(),
  type: z.string().optional(),
});

const precipitationSchema = z.object({
  probability: z.object({ percent: z.number().optional(), type: z.string().optional() }).optional(),
  qpf: z.object({ quantity: z.number().optional(), unit: z.string().optional() }).optional(),
  snowQpf: z.object({ quantity: z.number().optional(), unit: z.string().optional() }).optional(),
});

const windSchema = z.object({
  direction: z.object({ degrees: z.number().optional(), cardinal: z.string().optional() }).optional(),
  speed: z.object({ value: z.number().optional(), unit: z.string().optional() }).optional(),
  gust: z.object({ value: z.number().optional(), unit: z.string().optional() }).optional(),
});

const conditionsSchema = z.object({
  isDaytime: z.boolean().optional(),
  weatherCondition: weatherConditionSchema.optional(),
  temperature: temperatureSchema.optional(),
  feelsLikeTemperature: temperatureSchema.optional(),
  heatIndex: temperatureSchema.optional(),
  relativeHumidity: z.number().optional(),
  uvIndex: z.number().optional(),
  precipitation: precipitationSchema.optional(),
  thunderstormProbability: z.number().optional(),
  wind: windSchema.optional(),
  dewPoint: temperatureSchema.optional(),
  windChill: temperatureSchema.optional(),
  cloudCover: z.number().optional(),
  visibility: z.object({ distance: z.number().optional(), unit: z.string().optional() }).optional(),
  airPressure: z.object({ meanSeaLevelMillibars: z.number().optional() }).optional(),
});

export const currentConditionsSchema = conditionsSchema.extend({
  currentTime: z.string().optional(),
  timeZone: timeZoneSchema.optional(),
  currentConditionsHistory: z.object({
    temperatureChange: temperatureSchema.optional(),
    maxTemperature: temperatureSchema.optional(),
    minTemperature: temperatureSchema.optional(),
    qpf: precipitationSchema.shape.qpf.optional(),
  }).optional(),
});

export const forecastHoursSchema = z.object({
  forecastHours: z.array(conditionsSchema.extend({
    interval: intervalSchema.optional(),
    displayDateTime: z.object({
      year: z.number().optional(),
      month: z.number().optional(),
      day: z.number().optional(),
      hours: z.number().optional(),
      utcOffset: z.string().optional(),
    }).optional(),
  })).optional(),
  timeZone: timeZoneSchema.optional(),
  nextPageToken: z.string().optional(),
});

const forecastPeriodSchema = conditionsSchema.omit({ temperature: true, feelsLikeTemperature: true }).extend({
  interval: intervalSchema.optional(),
});

export const forecastDaysSchema = z.object({
  forecastDays: z.array(z.object({
    interval: intervalSchema.optional(),
    displayDate: z.object({
      year: z.number().optional(),
      month: z.number().optional(),
      day: z.number().optional(),
    }).optional(),
    daytimeForecast: forecastPeriodSchema.optional(),
    nighttimeForecast: forecastPeriodSchema.optional(),
    maxTemperature: temperatureSchema.optional(),
    minTemperature: temperatureSchema.optional(),
    feelsLikeMaxTemperature: temperatureSchema.optional(),
    feelsLikeMinTemperature: temperatureSchema.optional(),
    maxHeatIndex: temperatureSchema.optional(),
    sunEvents: z.object({ sunriseTime: z.string().optional(), sunsetTime: z.string().optional() }).optional(),
    moonEvents: z.object({
      moonPhase: z.string().optional(),
      moonriseTimes: z.array(z.string()).optional(),
      moonsetTimes: z.array(z.string()).optional(),
    }).optional(),
  })).optional(),
  timeZone: timeZoneSchema.optional(),
  nextPageToken: z.string().optional(),
});

export const publicAlertsSchema = z.object({
  weatherAlerts: z.array(z.object({
    alertId: z.string().optional(),
    alertTitle: z.object({ text: z.string().optional(), languageCode: z.string().optional() }).optional(),
    eventType: z.string().optional(),
    areaName: z.string().optional(),
    instruction: z.array(z.string()).optional(),
    safetyRecommendations: z.array(z.object({
      directive: z.string().optional(),
      subtext: z.string().optional(),
    })).optional(),
    timezoneOffset: z.string().optional(),
    startTime: z.string().optional(),
    expirationTime: z.string().optional(),
    dataSource: z.object({
      publisher: z.string().optional(),
      name: z.string().optional(),
      authorityUri: z.string().optional(),
    }).optional(),
    polygon: z.unknown().optional(),
    description: z.string().optional(),
    severity: z.string().optional(),
    certainty: z.string().optional(),
    urgency: z.string().optional(),
  })).optional(),
  regionCode: z.string().optional(),
  nextPageToken: z.string().optional(),
});

export type CurrentConditions = z.infer<typeof currentConditionsSchema>;
export type ForecastHours = z.infer<typeof forecastHoursSchema>;
export type ForecastDays = z.infer<typeof forecastDaysSchema>;
export type PublicAlerts = z.infer<typeof publicAlertsSchema>;

export interface WeatherMetrics {
  tempC?: number;
  feelsLikeC?: number;
  heatIndexC?: number;
  humidity?: number;
  uvIndex?: number;
  rainChance?: number;
  rainMm?: number;
  thunderChance?: number;
  windKmh?: number;
  gustKmh?: number;
  windDir?: string;
  conditionType?: string;
  iconBaseUri?: string;
  description?: string;
  isDaytime?: boolean;
}

export interface WeatherHour extends WeatherMetrics {
  startTime?: string;
  endTime?: string;
}

export interface WeatherPeriod extends WeatherMetrics {
  startTime?: string;
  endTime?: string;
}

export interface WeatherDay {
  date?: string;
  startTime?: string;
  endTime?: string;
  maxTempC?: number;
  minTempC?: number;
  feelsLikeMaxC?: number;
  feelsLikeMinC?: number;
  maxHeatIndexC?: number;
  day: WeatherPeriod;
  night: WeatherPeriod;
  sunrise?: string;
  sunset?: string;
  moonPhase?: string;
  moonrise?: string;
  moonset?: string;
}

export interface WeatherAlert {
  id?: string;
  title?: string;
  eventType?: string;
  areaName?: string;
  instructions: string[];
  safetyRecommendations: { directive?: string; subtext?: string }[];
  startTime?: string;
  expirationTime?: string;
  description?: string;
  severity?: string;
  certainty?: string;
  urgency?: string;
}

export interface WeatherSnapshot extends WeatherMetrics {
  hours: WeatherHour[];
  days: WeatherDay[];
  alerts: WeatherAlert[];
  timeZone?: string;
  fetchedAt?: string;
}

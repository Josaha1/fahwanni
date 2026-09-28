export type ConditionGroup = "clear" | "cloud" | "rain" | "storm" | "snow" | "wind" | "hail";

type ConditionDescription = { th: string; en: string; group: ConditionGroup };

export const conditionTable = {
  CLEAR: { th: "ฟ้าโปร่ง", en: "Clear", group: "clear" },
  MOSTLY_CLEAR: { th: "ฟ้าเกือบโปร่ง", en: "Mostly clear", group: "clear" },
  PARTLY_CLOUDY: { th: "มีเมฆบางส่วน", en: "Partly cloudy", group: "cloud" },
  MOSTLY_CLOUDY: { th: "เมฆมาก", en: "Mostly cloudy", group: "cloud" },
  CLOUDY: { th: "เมฆเต็มท้องฟ้า", en: "Cloudy", group: "cloud" },
  WINDY: { th: "ลมแรง", en: "Windy", group: "wind" },
  WIND_AND_RAIN: { th: "ฝนตกและลมแรง", en: "Wind and rain", group: "wind" },
  LIGHT_RAIN_SHOWERS: { th: "ฝนตกเป็นช่วง ๆ เล็กน้อย", en: "Light rain showers", group: "rain" },
  CHANCE_OF_SHOWERS: { th: "อาจมีฝนตกเป็นช่วง ๆ", en: "Chance of showers", group: "rain" },
  SCATTERED_SHOWERS: { th: "ฝนตกเป็นหย่อม ๆ", en: "Scattered showers", group: "rain" },
  RAIN_SHOWERS: { th: "ฝนตกเป็นช่วง ๆ", en: "Rain showers", group: "rain" },
  HEAVY_RAIN_SHOWERS: { th: "ฝนตกหนักเป็นช่วง ๆ", en: "Heavy rain showers", group: "rain" },
  LIGHT_TO_MODERATE_RAIN: { th: "ฝนตกเล็กน้อยถึงปานกลาง", en: "Light to moderate rain", group: "rain" },
  MODERATE_TO_HEAVY_RAIN: { th: "ฝนตกปานกลางถึงหนัก", en: "Moderate to heavy rain", group: "rain" },
  RAIN: { th: "ฝนตก", en: "Rain", group: "rain" },
  LIGHT_RAIN: { th: "ฝนตกเล็กน้อย", en: "Light rain", group: "rain" },
  HEAVY_RAIN: { th: "ฝนตกหนัก", en: "Heavy rain", group: "rain" },
  RAIN_PERIODICALLY_HEAVY: { th: "ฝนตกหนักบางช่วง", en: "Rain, heavy at times", group: "rain" },
  LIGHT_SNOW_SHOWERS: { th: "หิมะตกเป็นช่วง ๆ เล็กน้อย", en: "Light snow showers", group: "snow" },
  CHANCE_OF_SNOW_SHOWERS: { th: "อาจมีหิมะตกเป็นช่วง ๆ", en: "Chance of snow showers", group: "snow" },
  SCATTERED_SNOW_SHOWERS: { th: "หิมะตกเป็นหย่อม ๆ", en: "Scattered snow showers", group: "snow" },
  SNOW_SHOWERS: { th: "หิมะตกเป็นช่วง ๆ", en: "Snow showers", group: "snow" },
  HEAVY_SNOW_SHOWERS: { th: "หิมะตกหนักเป็นช่วง ๆ", en: "Heavy snow showers", group: "snow" },
  LIGHT_TO_MODERATE_SNOW: { th: "หิมะตกเล็กน้อยถึงปานกลาง", en: "Light to moderate snow", group: "snow" },
  MODERATE_TO_HEAVY_SNOW: { th: "หิมะตกปานกลางถึงหนัก", en: "Moderate to heavy snow", group: "snow" },
  SNOW: { th: "หิมะตก", en: "Snow", group: "snow" },
  LIGHT_SNOW: { th: "หิมะตกเล็กน้อย", en: "Light snow", group: "snow" },
  HEAVY_SNOW: { th: "หิมะตกหนัก", en: "Heavy snow", group: "snow" },
  SNOWSTORM: { th: "พายุหิมะ", en: "Snowstorm", group: "snow" },
  SNOW_PERIODICALLY_HEAVY: { th: "หิมะตกหนักบางช่วง", en: "Snow, heavy at times", group: "snow" },
  HEAVY_SNOW_STORM: { th: "พายุหิมะรุนแรง", en: "Heavy snowstorm", group: "snow" },
  BLOWING_SNOW: { th: "หิมะปลิวตามลม", en: "Blowing snow", group: "snow" },
  RAIN_AND_SNOW: { th: "ฝนและหิมะตก", en: "Rain and snow", group: "snow" },
  HAIL: { th: "ลูกเห็บตก", en: "Hail", group: "hail" },
  HAIL_SHOWERS: { th: "ลูกเห็บตกเป็นช่วง ๆ", en: "Hail showers", group: "hail" },
  THUNDERSTORM: { th: "พายุฝนฟ้าคะนอง", en: "Thunderstorm", group: "storm" },
  THUNDERSHOWER: { th: "ฝนฟ้าคะนองเป็นช่วง ๆ", en: "Thundershower", group: "storm" },
  LIGHT_THUNDERSTORM_RAIN: { th: "ฝนฟ้าคะนองเล็กน้อย", en: "Light thunderstorm rain", group: "storm" },
  SCATTERED_THUNDERSTORMS: { th: "พายุฝนฟ้าคะนองเป็นหย่อม ๆ", en: "Scattered thunderstorms", group: "storm" },
  HEAVY_THUNDERSTORM: { th: "พายุฝนฟ้าคะนองรุนแรง", en: "Heavy thunderstorm", group: "storm" },
  TYPE_UNSPECIFIED: { th: "ไม่ทราบสภาพอากาศ", en: "Weather unavailable", group: "cloud" },
} as const satisfies Record<string, ConditionDescription>;

export function describeCondition(type?: string): ConditionDescription {
  return type && Object.prototype.hasOwnProperty.call(conditionTable, type)
    ? conditionTable[type as keyof typeof conditionTable]
    : conditionTable.TYPE_UNSPECIFIED;
}

export function iconUrl(iconBaseUri: string, dark: boolean): string {
  return `${iconBaseUri}${dark ? "_dark" : ""}.svg`;
}

/** Blender-rendered looping sprite sheet (24 × 128 px frames) for a condition, day or night. */
export function animSheet(type: string | undefined, isDaytime: boolean | undefined): string {
  return `/anim/${describeCondition(type).group}-${isDaytime === false ? "night" : "day"}.webp`;
}

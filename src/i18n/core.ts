/**
 * Translation, gettext-style: the Thai UI text itself is the key. `t("เพิ่มยา")` returns the English
 * entry when the locale is "en" and one exists, otherwise the Thai text, so an untranslated string can
 * never render empty. Placeholders use {name}: t("ให้ยาครบ {n} วันติด", { n: 3 }).
 */
import { en } from "./en";

export const LOCALES = ["th", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "th";
export const LOCALE_COOKIE = "fah-locale";

export type Params = Record<string, string | number>;
/** A translator; `locale` tells formatting helpers which language they are writing in. */
export type T = ((text: string, params?: Params) => string) & { locale?: Locale };

export function isLocale(value: unknown): value is Locale {
  return value === "th" || value === "en";
}

/**
 * Fills {name}. English plurals use {name:one|many}: "{n} {n:day|days} ago" → "1 day ago" / "3 days ago".
 * Thai has no plural forms, so Thai keys only ever use plain {name}.
 */
export function interpolate(text: string, params?: Params) {
  if (!params) return text;
  return text
    .replace(/\{(\w+):([^|{}]*)\|([^{}]*)\}/g, (match, key: string, one: string, many: string) => (key in params ? (Number(params[key]) === 1 ? one : many) : match))
    .replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

export function translator(locale: Locale): T & { locale: Locale } {
  return Object.assign((text: string, params?: Params) => interpolate(locale === "en" ? (en[text] ?? text) : text, params), { locale });
}

/** Intl tag for whichever language `t` writes. */
export function intlOf(t: T) {
  return intlLocale(t.locale ?? DEFAULT_LOCALE);
}

/** For library code called without a locale: Thai, with placeholders filled. */
export const thai: T = translator("th");

/** BCP 47 tag for Intl formatting: Thai uses the Buddhist calendar, English day-month-year. */
export function intlLocale(locale: Locale) {
  return locale === "en" ? "en-GB" : "th-TH";
}

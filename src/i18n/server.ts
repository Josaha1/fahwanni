import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, intlLocale, isLocale, LOCALE_COOKIE, translator, type Locale } from "./core";

/** The viewer's language: the cookie set by the switcher, else Thai. */
export const getLocale = cache(async (): Promise<Locale> => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return DEFAULT_LOCALE;
});

/** Translator for the current request. */
export async function getT() {
  const locale = await getLocale();
  return Object.assign(translator(locale), { locale, intl: intlLocale(locale) });
}

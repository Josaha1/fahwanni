"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, intlLocale, translator, type Locale, type T } from "./core";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

/** Translator for client components, with the Intl tag for date formatting. */
export function useT(): T & { locale: Locale; intl: string } {
  const locale = useLocale();
  return useMemo(() => Object.assign(translator(locale), { locale, intl: intlLocale(locale) }), [locale]);
}

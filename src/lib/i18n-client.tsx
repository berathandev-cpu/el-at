"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, getLocale, type Language } from "./i18n";

function valueFor(language: Language) {
  return { language, locale: getLocale(language), t: createTranslator(language) };
}

const I18nContext = createContext(valueFor("tr"));

export function I18nProvider({ children, language }: { children: ReactNode; language: Language }) {
  const value = useMemo(() => valueFor(language), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslations() {
  return useContext(I18nContext);
}

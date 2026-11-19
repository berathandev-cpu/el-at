import { cookies } from "next/headers";
import { cache } from "react";
import { createTranslator, getLocale, isLanguage } from "./i18n";
import { isTheme, languageCookieName, themeCookieName } from "./preference-values";

export const getPreferences = cache(async () => {
  const jar = await cookies();
  const language = jar.get(languageCookieName)?.value;
  const theme = jar.get(themeCookieName)?.value;
  return {
    language: isLanguage(language) ? language : "tr" as const,
    theme: isTheme(theme) ? theme : "system" as const,
  };
});

export const getTranslations = cache(async () => {
  const { language } = await getPreferences();
  return { language, locale: getLocale(language), t: createTranslator(language) };
});

import { familyMessages } from "./i18n/family";
import { overviewMessages } from "./i18n/overview";
import { sharedMessages } from "./i18n/shared";
import { taskMessages } from "./i18n/tasks";

export const languageOptions = [
  { value: "tr", label: "Türkçe", locale: "tr-TR" },
  { value: "en", label: "English", locale: "en-US" },
  { value: "zh", label: "简体中文", locale: "zh-CN" },
] as const;

export type Language = (typeof languageOptions)[number]["value"];
export type Translate = (message: string, values?: Readonly<Record<string, string | number>>) => string;

const messages: Readonly<Record<string, readonly [string, string]>> = {
  ...taskMessages,
  ...familyMessages,
  ...overviewMessages,
  ...sharedMessages,
};

export function isLanguage(value: unknown): value is Language {
  return languageOptions.some((option) => option.value === value);
}

export function getLocale(language: Language) {
  return languageOptions.find((option) => option.value === language)?.locale ?? "tr-TR";
}

export function createTranslator(language: Language): Translate {
  return (message, values) => {
    const entry = language !== "tr" && Object.hasOwn(messages, message) ? messages[message] : undefined;
    const text = entry ? entry[language === "en" ? 0 : 1] : message;
    return values
      ? text.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
        Object.hasOwn(values, key) ? String(values[key]) : placeholder,
      )
      : text;
  };
}

export const themeOptions = [
  { value: "system", label: "Sistem" },
  { value: "light", label: "Açık tema" },
  { value: "dark", label: "Koyu tema" },
] as const;

export type Theme = (typeof themeOptions)[number]["value"];

export const languageCookieName = "elat-language";
export const themeCookieName = "elat-theme";

export function isTheme(value: unknown): value is Theme {
  return themeOptions.some((option) => option.value === value);
}

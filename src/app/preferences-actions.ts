"use server";

import { cookies } from "next/headers";
import { isLanguage } from "@/lib/i18n";
import { isTheme, languageCookieName, themeCookieName } from "@/lib/preference-values";

type State = { saved?: boolean; error?: string };

export async function savePreferences(_state: State, formData: FormData): Promise<State> {
  const language = formData.get("language");
  const theme = formData.get("theme");
  if (!isLanguage(language) || !isTheme(theme)) return { error: "Geçerli bir tema ve dil seç." };

  const jar = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.AUTH_URL?.startsWith("https://") ?? false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  } as const;
  jar.set(languageCookieName, language, options);
  jar.set(themeCookieName, theme, options);
  return { saved: true };
}

import type { MetadataRoute } from "next";
import { getPreferences, getTranslations } from "@/lib/preferences";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [{ theme }, { t, locale }] = await Promise.all([getPreferences(), getTranslations()]);
  const color = theme === "dark" ? "#242b31" : "#efe8dd";
  return {
    id: "/",
    name: t("El At! — Aile görev panosu"),
    short_name: "El At!",
    description: t("Aile içi görevler, puanlar ve haftalık ödüller."),
    lang: locale,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: color,
    theme_color: color,
    icons: [
      { src: "/install-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/install-icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}

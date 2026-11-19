import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/lib/i18n-client";
import { getPreferences, getTranslations } from "@/lib/preferences";
import { AppChrome } from "./app-chrome";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return {
    title: t("El At! — Ev işleri paylaşılır"),
    description: t("Aile bireylerinin ev işlerini puanlayan, doğrulayan ve haftalık ödüllerle motive eden aile görev panosu."),
    icons: { icon: "/install-icon/192", apple: "/install-icon/192" },
    robots: { index: false, follow: false },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { theme } = await getPreferences();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    colorScheme: theme === "system" ? "light dark" : theme,
    themeColor: theme === "system"
      ? [
        { media: "(prefers-color-scheme: light)", color: "#efe8dd" },
        { media: "(prefers-color-scheme: dark)", color: "#242b31" },
      ]
      : theme === "dark" ? "#242b31" : "#efe8dd",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [{ theme }, { language, locale }] = await Promise.all([getPreferences(), getTranslations()]);
  return (
    <html lang={locale} data-theme={theme}>
      <body className="font-sans antialiased">
        <I18nProvider language={language}><AppChrome>{children}</AppChrome></I18nProvider>
      </body>
    </html>
  );
}

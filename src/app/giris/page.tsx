import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getPreferences, getTranslations } from "@/lib/preferences";
import { signInWithDemo, signInWithGoogle } from "./actions";
import { GoogleSignInButton } from "./submit-button";
import { DemoSignInForm } from "./demo-signin";
import { PlanMotif } from "../plan-motif";
import { PreferencesPanel } from "../preferences-panel";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: `${t("Giriş yap")} — El At!` };
}

// Auth.js `pages.error` bizi buraya `?error=...` ile geri gönderir.
// Kod → kullanıcıya gösterilecek mesaj eşlemesi (bkz. authjs.dev/reference/core/errors).
const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "Bu e-posta adresi zaten farklı bir girişle ilişkili. Aynı Google hesabıyla tekrar dene.",
  AccessDenied: "Giriş izni verilmedi.",
  CredentialsSignin: "Demo profili açılamadı. Demo parolasını kontrol et.",
  Configuration: "Giriş şu anda yapılandırma hatası nedeniyle kullanılamıyor.",
  Default: "Giriş yapılamadı. Lütfen tekrar dene.",
};

type SearchParams = Promise<{ error?: string; callbackUrl?: string; durum?: string }>;

export default async function GirisPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  // Girişi yapmış kullanıcıyı giriş ekranında tutmanın anlamı yok.
  const session = await auth();
  if (session?.user) {
    redirect("/bugun");
  }
  const [{ t, language }, { theme }] = await Promise.all([getTranslations(), getPreferences()]);

  const errorMessage = params.error
    ? (Object.hasOwn(ERROR_MESSAGES, params.error) ? ERROR_MESSAGES[params.error] : ERROR_MESSAGES.Default)
    : null;
  const noticeCode = params.durum && (await cookies()).get("elat-account-notice")?.value === params.durum
    ? params.durum : null;
  const notice = noticeCode === "hesap-silindi" ? "El At! hesabın silindi."
    : noticeCode === "cikis" ? "Çıkış yaptın." : null;
  const demoEnabled =
    process.env.NODE_ENV === "development" &&
    process.env.AUTH_DEMO_MODE === "true";
  const googleConfigured =
    Boolean(process.env.AUTH_GOOGLE_ID) &&
    process.env.AUTH_GOOGLE_ID !== "local-placeholder" &&
    Boolean(process.env.AUTH_GOOGLE_SECRET) &&
    process.env.AUTH_GOOGLE_SECRET !== "local-placeholder";

  return (
    <main className="entry">
      <header className="entry-identity">
        <div className="entry-art" aria-hidden="true"><PlanMotif className="entry-plan" /></div>
        <h1>El At!</h1>
        <p className="mt-2">{t("Ev işlerinizi ailece paylaşın. Odaları görün, görevleri üstlenin.")}</p>
      </header>
          <section className="surface glass-control entry-panel" aria-labelledby="giris-baslik">
            <h2 id="giris-baslik" className="mb-4 text-xl font-extrabold">{t("Aile panonu aç")}</h2>
            {notice && <p role="status" className="mb-4 rounded-sm bg-paper-raised px-4 py-3 text-sm font-semibold text-success">{t(notice)}</p>}
            {errorMessage ? (
              <p
                role="alert"
                className="mb-6 rounded-sm border border-danger/30 bg-danger-ink px-4 py-3 text-sm text-danger"
              >
                {t(errorMessage)}
              </p>
            ) : null}

            {googleConfigured ? (
              <form action={signInWithGoogle}>
                <input
                  type="hidden"
                  name="callbackUrl"
                  value={params.callbackUrl ?? ""}
                />
                <GoogleSignInButton />
              </form>
            ) : (
              <p className="rounded-sm border border-line bg-paper-raised px-4 py-3 text-center text-sm text-ink-muted">
                {t("Google girişi için OAuth anahtarlarını .env dosyasına ekle.")}
              </p>
            )}

            {demoEnabled ? (
              <details className="entry-demo">
                <summary>{t("Yerel uygulama demosu")}</summary>
                <p className="mb-4 mt-1 text-xs text-ink-muted">
                  {t("Google hesabı olmadan örnek aileyi ebeveyn veya çocuk görünümünde aç.")}
                </p>
                <DemoSignInForm action={signInWithDemo} />
              </details>
            ) : null}

            <PreferencesPanel language={language} theme={theme} compact />
          </section>
    </main>
  );
}

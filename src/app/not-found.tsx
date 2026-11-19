import Link from "next/link";
import { getTranslations } from "@/lib/preferences";

export default async function NotFound() {
  const { t } = await getTranslations();
  return (
    <main className="panel-page panel-page--reading">
      <header><h1 className="font-extrabold">{t("Sayfa bulunamadı")}</h1></header>
      <section className="surface">
        <p className="text-ink-muted">{t("Bu sayfa kaldırılmış veya bağlantı değişmiş olabilir.")}</p>
        <Link href="/" className="primary-action mt-4">{t("Ana sayfaya dön")}</Link>
      </section>
    </main>
  );
}

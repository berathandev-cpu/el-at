import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getTranslations } from "@/lib/preferences";
import { getWeeklyRewards } from "@/lib/weekly-rewards";
import { RewardForm } from "./reward-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: `${t("Haftalık ödül")} — El At!` };
}

export default async function RewardsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris");

  const { t, locale, language } = await getTranslations();
  const weekLabel = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Istanbul", day: "numeric", month: "long", year: "numeric",
  });
  const number = new Intl.NumberFormat(locale);
  const winnerList = new Intl.ListFormat(locale, { type: "conjunction" });
  const formatWeek = (start: Date, end: Date) => weekLabel.formatRange(start, new Date(end.getTime() - 1));
  const rewards = await getWeeklyRewards(session.user.id, undefined, language);
  if (!rewards) redirect("/aile");

  const { week, current, canEdit, history } = rewards;
  const weekKey = week.start.toISOString();

  return (
    <main className="panel-page panel-page--reading">
      <header>
        <Link href="/aile" className="text-sm text-cream/70 hover:text-cream">← {t("Ailem")}</Link>
        <h1 className="mt-2 text-3xl font-extrabold text-cream">{t("Haftalık ödül")}</h1>
        <p className="mt-2 text-sm text-cream/80">
          {t("Hafta bittiğinde en yüksek onaylı puanı alan ödülü kazanır. Eşitlikte birincilik paylaşılır.")}
        </p>
      </header>

      <section className="mt-6 rounded-sm border border-line bg-paper p-5 text-ink" aria-labelledby="current-reward">
        <p className="text-sm text-ink-muted">{formatWeek(week.start, week.end)}</p>
        <h2 id="current-reward" className="mt-1 text-lg font-bold">{t("Bu haftanın ödülü")}</h2>
        <p className="mt-2 break-words">{current?.title ?? t("Bu hafta için henüz bir ödül belirlenmedi.")}</p>
        {canEdit && <RewardForm key={weekKey} week={weekKey} initialTitle={current?.title ?? ""} />}
      </section>

      <Link href="/gorevler" className="mt-4 block rounded-sm border border-gold/40 px-4 py-3 text-sm font-semibold text-gold hover:bg-board-line/30">
        {t("Bu haftanın puan tablosuna git")} →
      </Link>

      <section className="mt-8" aria-labelledby="previous-rewards">
        <h2 id="previous-rewards" className="text-lg font-bold">{t("Son 6 ödül")}</h2>
        {!history.length && <p className="mt-2 text-sm text-cream/70">{t("Geçmiş haftalara ait ödül yok.")}</p>}
        {!!history.length && (
          <ul className="mt-3 space-y-2">
            {history.map((reward) => (
              <li key={reward.id} className="rounded-sm border border-board-line bg-board-deep p-4">
                <p className="text-sm text-cream/70">{formatWeek(reward.start, reward.end)}</p>
                <h3 className="mt-1 break-words font-semibold">{reward.title}</h3>
                <p className="mt-2 break-words text-sm text-gold">
                  {reward.winners.length
                    ? `${winnerList.format(reward.winners)} · ${t("{points} puan", { points: number.format(reward.topScore), plural: reward.topScore === 1 ? "" : "s" })}`
                    : t("Onaylı puan olmadığı için kazanan çıkmadı.")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

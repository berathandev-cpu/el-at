import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { formatApprovalDate, getFamilyReport } from "@/lib/family-report";
import { getTranslations } from "@/lib/preferences";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: `${t("Aile raporu")} — El At!` };
}

const navigationStyle = "inline-flex min-h-11 items-center rounded-sm border border-board-line px-3 text-sm font-semibold text-cream hover:bg-board-line/30";
const visibleEntries = 20;

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ hafta?: string | string[] }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris");

  const { t, locale, language } = await getTranslations();
  const date = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Istanbul", day: "numeric", month: "long", year: "numeric",
  });
  const number = new Intl.NumberFormat(locale);
  const leaderList = new Intl.ListFormat(locale, { type: "conjunction" });
  const formatPoints = (points: number) => t("{points} puan", { points: number.format(points), plural: points === 1 ? "" : "s" });
  const { hafta } = await searchParams;
  const report = await getFamilyReport(session.user.id, Array.isArray(hafta) ? "" : hafta, undefined, language);
  if (report.status === "no-family") redirect("/aile");
  if (report.status === "forbidden") redirect("/bugun");
  if (report.status === "invalid-week") redirect("/raporlar");

  return (
    <main className="panel-page panel-page--reading">
      <header>
        <Link href="/bugun" className="inline-flex min-h-11 items-center text-sm text-cream/70 hover:text-cream">← {t("Bugün")}</Link>
        <p className="mt-2 break-words text-sm font-medium text-gold">{report.familyName}</p>
        <h1 className="mt-1 text-3xl font-extrabold text-cream">{t("Aile raporu")}</h1>
      </header>

      <section aria-labelledby="report-week" className="mt-6 rounded-sm border border-board-line bg-board-deep p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t(report.isCurrent ? "Devam eden hafta" : "Kapanan hafta")}</p>
        <h2 id="report-week" className="mt-1 text-xl font-bold text-cream">
          {date.formatRange(report.week.start, new Date(report.week.end.getTime() - 1))}
        </h2>
        <nav aria-label={t("Rapor haftası")} className="mt-3 flex flex-wrap gap-2">
          {report.previousKey && <Link href={`/raporlar?hafta=${report.previousKey}`} className={navigationStyle}>← {t("Önceki hafta")}</Link>}
          {report.nextKey && <Link href={`/raporlar?hafta=${report.nextKey}`} className={navigationStyle}>{t("Sonraki hafta")} →</Link>}
          {!report.isCurrent && <Link href="/raporlar" className={navigationStyle}>{t("Bu haftaya dön")}</Link>}
        </nav>
      </section>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-ink sm:gap-3">
        {[
          ["Onaylanan", number.format(report.entries.length)],
          ["Toplam puan", number.format(report.totalPoints)],
          ["Katkı veren", number.format(report.contributions.length)],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse rounded-sm border border-line bg-paper px-3 py-3 sm:px-4">
            <dt className="mt-1 text-xs font-semibold text-ink-muted sm:text-sm">{t(label)}</dt>
            <dd className="break-words text-2xl font-extrabold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="report-contributions" className="mt-5 rounded-sm border border-line bg-paper p-4 text-ink sm:p-5">
        <h2 id="report-contributions" className="text-lg font-bold">{t("Kim ne yaptı?")}</h2>
        {report.reward && <p className="mt-1 break-words text-sm text-ink-muted">{t("Haftalık ödül")} · {report.reward.title}</p>}
        {report.leaders.length > 0 && (
          <p className="mt-2 break-words text-sm font-semibold text-board">
            {t(report.isCurrent ? "Şimdilik önde" : "Haftayı önde bitirenler")} · {leaderList.format(report.leaders.map((leader) => leader.person))}
          </p>
        )}
        {report.contributions.length > 0 ? (
          <ol className="mt-3 divide-y divide-line">
            {report.contributions.map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="break-words font-semibold">{member.person}</p>
                  <p className="text-xs text-ink-muted">{t("{count} onaylı görev", { count: number.format(member.count), plural: member.count === 1 ? "" : "s" })}</p>
                </div>
                <p className="shrink-0 font-bold tabular-nums">{formatPoints(member.points)}</p>
              </li>
            ))}
          </ol>
        ) : <p className="mt-2 text-sm text-ink-muted">{t("Bu hafta henüz onaylı görev yok.")}</p>}
      </section>

      <section aria-labelledby="report-activity" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="report-activity" className="text-lg font-bold text-cream">{t("Onaylanan görevler")}</h2>
          {report.entries.length > 0 && (
            <a href={`/raporlar/indir?hafta=${report.key}`} download className="inline-flex min-h-11 items-center rounded-sm border border-gold/40 px-3 text-sm font-bold text-gold hover:bg-board-line/30">
              {t("CSV indir")}
            </a>
          )}
        </div>
        {report.entries.length > visibleEntries && (
          <p className="mt-1 text-sm text-cream/70">{t("Son {count} görev gösteriliyor. CSV tüm haftayı içerir.", { count: number.format(visibleEntries) })}</p>
        )}
        {report.entries.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {report.entries.slice(0, visibleEntries).map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 rounded-sm border border-board-line bg-board-deep p-3">
                <div className="min-w-0 break-words">
                  <p className="font-semibold text-cream">{entry.task}</p>
                  <p className="text-sm text-cream/75">{entry.person} · {entry.room}</p>
                  <time dateTime={entry.earnedAt.toISOString()} className="text-xs text-cream/65">{formatApprovalDate(entry.earnedAt, locale)}</time>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums text-gold">+{formatPoints(entry.points)}</p>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-cream/70">{t("Onaylanan görevler burada listelenir.")}</p>}
      </section>
    </main>
  );
}

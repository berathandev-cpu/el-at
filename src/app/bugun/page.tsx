import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getTranslations } from "@/lib/preferences";
import { getToday } from "@/lib/today";
import { PlanMotif } from "../plan-motif";
import styles from "./glass-dashboard.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: `${t("Bugün")} — El At!` };
}

const quickLinks = [
  { href: "/tekrarlar", label: "Görev planları", description: "Günlük ve haftalık tekrar", icon: "repeat" },
  { href: "/raporlar", label: "Aile raporu", description: "Haftalık döküm ve CSV", icon: "report" },
] as const;

const glyphs = {
  add: "M12 5v14M5 12h14",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  chevron: "m9 6 6 6-6 6",
  check: "M5 12l4 4L19 6",
  tasks: "M4.5 7.5l2 2 3.5-4m-5.5 10 2 2 3.5-4M13 8h6m-6 8h6",
  gift: "M4 10h16v4H4zm2 4v6h12v-6m-6-4v10m0-10H8.5A2.5 2.5 0 1 1 11 7.5zm0 0h3.5A2.5 2.5 0 1 0 13 7.5z",
  repeat: "M20 8H7l3-3M4 16h13l-3 3M20 8l-3 3M4 16l3-3",
  report: "M5 19V5m0 14h14m-10-4v-4m4 4V8m4 7V5",
};

function Glyph({ name, size = 20 }: { name: keyof typeof glyphs; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={glyphs[name]} />
    </svg>
  );
}

export default async function TodayPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris?callbackUrl=/bugun");

  const { t, locale } = await getTranslations();
  const todayLabel = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Istanbul", weekday: "long", day: "numeric", month: "long",
  });
  const numberLabel = new Intl.NumberFormat(locale);
  const now = new Date();
  const dashboard = await getToday(session.user.id, now);
  if (!dashboard) redirect("/aile");

  const { admin, familyName, focus, active, waiting, weekApproved, weekPoints, reward, availableTasks } = dashboard;
  const focusCount = admin ? waiting : active;
  const taskCount = (count: number) => ({ count: numberLabel.format(count), plural: count === 1 ? "" : "s" });
  const metrics = [
    { label: admin ? "Açık görev" : "Sıradaki görev", value: active },
    { label: "Onay bekleyen", value: waiting },
    { label: "Bu hafta onaylanan", value: weekApproved },
    { label: admin ? "Ailenin haftalık puanı" : "Haftalık puanın", value: weekPoints },
  ];

  return (
    <main className={`panel-page ${styles.dashboard}`}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.identity}><span>{familyName}</span><time dateTime={now.toISOString()}>{todayLabel.format(now)}</time></p>
          <h1>{t("Bugün")}</h1>
        </div>
        {admin && (
          <Link href="/gorevler#yeni-gorev" className="primary-action">
            <Glyph name="add" size={19} /> {t("Yeni görev")}
          </Link>
        )}
      </header>

      <div className={styles.layout}>
        <div className={styles.stack}>
          <section aria-labelledby="today-focus" className={`surface ${styles.focusPanel}`}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>
                <span className={styles.focusIcon}><Glyph name="tasks" /></span>
                <div>
                  <h2 id="today-focus">{t(admin ? "Onay sırası" : "Sıradaki görevlerin")}</h2>
                  {focusCount > 0 && <p>{t("{count} görev", taskCount(focusCount))}</p>}
                </div>
              </div>
              <Link href="/gorevler" className="secondary-action text-sm">{t("Görev panosunu aç")}</Link>
            </div>
            {focus.length ? (
              <ul className={styles.taskList}>
                {focus.map((task) => (
                  <li key={task.id}>
                    <Link href={`/gorevler#gorev-${task.id}`} className={styles.task}>
                      <span>
                        <strong>{task.title}</strong>
                        <small>
                          {task.room.name}{admin && task.assignee?.name ? ` · ${task.assignee.name}` : ""}
                          {task.status === "REJECTED" && ` · ${t("Düzeltme istendi")}`}
                        </small>
                      </span>
                      <Glyph name="chevron" size={17} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.emptyLine}>
                <Glyph name="check" size={18} />
                <p>{t(admin ? "Şu anda onay bekleyen iş yok." : "Sana atanmış açık görev yok.")}</p>
              </div>
            )}
            {focusCount > focus.length && <p className={styles.remaining}>{t("Panoda {count} görev daha var.", taskCount(focusCount - focus.length))}</p>}
            {!admin && availableTasks > 0 && (
              <Link href="/gorevler#aileye-acik" className={`primary-action ${styles.openTasks}`}>
                <span>{t("Aileye açık {count} görev", taskCount(availableTasks))}</span>
                <Glyph name="arrow" size={19} />
              </Link>
            )}
          </section>
          <section aria-labelledby="today-week" className={`surface ${styles.metricsPanel}`}>
            <h2 id="today-week">{t("Görevler ve puan")}</h2>
            <dl className={styles.metrics}>
              {metrics.map(({ label, value }, index) => (
                <div key={label} className={index === 3 ? styles.points : undefined}>
                  <dt>{t(label)}</dt>
                  <dd>{numberLabel.format(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside aria-label={t("Ev haritası, ödül ve kısa yollar")} className={styles.stack}>
          <Link href="/ev" className={styles.planTile}>
            <span className={styles.planCopy}>
              <span className={styles.planTitle}>{t("Ev Haritası")}</span>
              <span className={styles.planDescription}>{t("Odaları ve görevleri aç")} <Glyph name="arrow" size={17} /></span>
            </span>
            <span className={styles.planArtwork} aria-hidden="true">
              <PlanMotif />
            </span>
          </Link>
          <section aria-labelledby="today-reward" className={`surface ${styles.reward}`}>
            <div className={styles.panelTitle}>
              <span className={styles.rewardIcon}><Glyph name="gift" /></span>
              <div>
                <h2 id="today-reward">{t("Bu haftanın ödülü")}</h2>
                <p>{reward ?? t("Henüz ödül belirlenmedi.")}</p>
              </div>
            </div>
            <Link href="/oduller" className={`secondary-action text-sm ${styles.rewardLink}`}>
              {t(admin && !reward ? "Ödül belirle" : "Ödül ve önceki kazananlar")}
            </Link>
          </section>
          {admin && (
            <nav aria-label={t("Ebeveyn kısa yolları")} className={`glass-control ${styles.quickLinks}`}>
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href} className={styles.quickLink}>
                  <Glyph name={link.icon} size={19} />
                  <span>
                    <strong>{t(link.label)}</strong>
                    <small>{t(link.description)}</small>
                  </span>
                  <Glyph name="chevron" size={16} />
                </Link>
              ))}
            </nav>
          )}
        </aside>
      </div>
    </main>
  );
}

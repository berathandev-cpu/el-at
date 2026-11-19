import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getTranslations } from "@/lib/preferences";
import { asCalendarInput, formatCalendarDay, istanbulCalendarDay, WEEKDAYS } from "@/lib/recurring-calendar";
import { getRecurringTaskSettings } from "@/lib/recurring-tasks";
import { RecurrenceForm, ToggleRecurringRuleForm } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: `${t("Tekrarlayan görevler")} — El At!` };
}

export default async function RecurringTasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris");

  const { t, locale } = await getTranslations();
  const settings = await getRecurringTaskSettings(session.user.id, t("İsimsiz"));
  if (!settings) redirect("/gorevler");

  const { rooms, members, rules } = settings;
  const today = asCalendarInput(istanbulCalendarDay());

  return (
    <main className="panel-page panel-page--reading">
      <header>
        <Link href="/gorevler" className="text-sm text-cream/70 hover:text-cream">← {t("Görev panosu")}</Link>
        <h1 className="mt-2 text-3xl font-extrabold text-cream">{t("Tekrarlayan görevler")}</h1>
        <p className="mt-2 text-sm text-cream/80">
          {t("Belirlenen gün görev panosu ilk açıldığında yeni görev oluşur. Günler İstanbul saatine göre hesaplanır. Geçmiş günler için görev birikmez.")}
        </p>
      </header>

      {rooms.length > 0 ? (
        <section className="mt-6 rounded-sm border border-line bg-paper p-5">
          <h2 className="text-lg font-bold text-ink">{t("Yeni görev planı")}</h2>
          <RecurrenceForm rooms={rooms} members={members} today={today} />
        </section>
      ) : (
        <p className="mt-6 rounded-sm border border-board-line bg-board-deep p-4 text-sm">
          {t("Önce ")}<Link href="/ev" className="font-semibold text-gold underline">{t("ev haritasına bir alan ekle")}</Link>{t(".")}
        </p>
      )}

      <section className="mt-8" aria-labelledby="scheduled-rules">
        <h2 id="scheduled-rules" className="text-lg font-bold text-cream">{t("Görev planları")}</h2>
        {rules.length === 0 && (
          <p className="mt-2 text-sm text-cream/70">{t("Henüz bir görev planı yok.")}</p>
        )}
        {rules.length > 0 && (
          <ul className="mt-3 space-y-3">
            {rules.map((rule) => {
              const version = rule.updatedAt.toISOString();
              const canResume = members.some((member) => member.id === rule.assignedToUserId);
              const weekday = WEEKDAYS.find((day) => day.value === rule.weekday);
              return (
                <li key={rule.id} className="rounded-sm border border-line bg-paper p-4 text-ink">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-bold [overflow-wrap:anywhere]">{rule.title}</h3>
                    <span className="text-xs font-semibold text-ink-muted">
                      {t(rule.active ? "Etkin" : "Duraklatıldı")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {rule.frequency === "DAILY" ? t("Her gün") : weekday ? t("Her {day}", { day: t(weekday.label) }) : t("Her hafta")}
                    {" · "}{rule.room.name}{" · "}{rule.assignee.name ?? t("İsimsiz")}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {t("Başlangıç {date}", { date: formatCalendarDay(rule.startsOn, locale) })}
                  </p>
                  <details className="mt-3">
                    <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-board underline underline-offset-4">
                      {t("Planı düzenle")}
                    </summary>
                    <RecurrenceForm
                      key={version}
                      rooms={rooms}
                      members={members}
                      today={today}
                      rule={{
                        id: rule.id,
                        updatedAt: version,
                        title: rule.title,
                        description: rule.description,
                        roomId: rule.roomId,
                        assignedToUserId: rule.assignedToUserId,
                        frequency: rule.frequency,
                        weekday: rule.weekday,
                        startsOn: asCalendarInput(rule.startsOn),
                      }}
                    />
                  </details>
                  <ToggleRecurringRuleForm
                    ruleId={rule.id} updatedAt={version} active={rule.active} canResume={canResume}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { formatCalendarDay } from "@/lib/recurring-calendar";
import { getTranslations } from "@/lib/preferences";
import { materializeRecurringTasks } from "@/lib/recurring-tasks";
import { listRooms } from "@/lib/rooms";
import { getTaskBoard } from "@/lib/tasks";
import { CancelTaskForm, ClaimTaskForm, CreateTaskForm, EditTaskForm, ReviewTaskForm, SubmitTaskForm } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: `${t("Görevler")} — El At!` };
}

type TaskTranslations = Pick<Awaited<ReturnType<typeof getTranslations>>, "t" | "locale">;

const ROLE_LABELS: Record<string, string> = { MOTHER: "Anne", FATHER: "Baba", CHILD: "Çocuk" };
const STATUS_LABELS: Record<string, string> = {
  OPEN: "Yapılacak",
  COMPLETED: "Onay bekliyor",
  APPROVED: "Onaylandı",
  REJECTED: "Düzeltme istendi",
  CANCELLED: "İptal edildi",
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ alan?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris");
  const { t, locale } = await getTranslations();
  const formatNumber = new Intl.NumberFormat(locale).format;

  const now = new Date();
  await materializeRecurringTasks(session.user.id, now);
  const board = await getTaskBoard(session.user.id, now);
  if (!board) redirect("/aile");

  const { alan } = await searchParams;
  const areaId = typeof alan === "string" ? alan : undefined;
  const rooms = board.admin || areaId ? await listRooms(board.membership.familyId) : [];
  const selectedArea = areaId ? rooms.find((room) => room.id === areaId) : undefined;
  const tasks = selectedArea ? board.tasks.filter((task) => task.roomId === selectedArea.id) : board.tasks;
  const roomOptions = rooms.map(({ id, name }) => ({ id, name }));
  const memberOptions = board.admin
    ? board.membership.family.members.map((member) => ({
        userId: member.userId,
        name: member.user.name ?? t("İsimsiz"),
      }))
    : [];
  const memberNames = new Map(board.membership.family.members.map((member) => [member.userId, member.user.name]));
  const pendingReview = tasks.filter((task) => task.status === "COMPLETED");
  const familyPool = board.admin ? [] : tasks.filter((task) => task.openToClaim);
  const visibleTasks = board.admin
    ? tasks.filter((task) => task.status !== "COMPLETED")
    : tasks.filter((task) => !task.openToClaim);

  return (
    <main className="panel-page">
      <header className="task-page-heading">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-muted">{board.membership.family.name}</p>
          <h1 className="mt-2 text-3xl font-extrabold text-cream">{t("Görev panosu")}</h1>
          <p className="mt-1 text-sm text-cream/60">
            {t(board.admin ? "Görevleri yönet ve gönderilenleri onayla." : "Görevlerini gönder ve onay durumunu takip et.")}
          </p>
        </div>
        {board.admin && (
          <div className="task-tools glass-control" role="group" aria-label={t("Görev araçları")}>
            <Link href="#yeni-gorev" className="primary-action text-sm"><span aria-hidden="true">+</span> {t("Yeni görev")}</Link>
            <Link href="/tekrarlar" className="task-tools-link">{t("Tekrarlayan görevleri yönet")}</Link>
          </div>
        )}
      </header>

      {selectedArea && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 rounded-sm border border-gold/40 bg-board-deep px-4 py-2">
          <p className="min-w-0 break-words text-sm font-bold">{t("{area} görevleri", { area: selectedArea.name })}</p>
          <Link href="/gorevler" className="inline-flex min-h-11 items-center text-sm font-semibold text-gold underline underline-offset-4">{t("Tüm alanlar")}</Link>
        </div>
      )}

      <div className="task-columns space-y-6 min-[69rem]:space-y-0">
        <div className="min-w-0 space-y-6">
          {board.admin ? (
            <section id="onay-bekleyenler" className="scroll-mt-8">
              <h2 className="text-lg font-bold text-cream">{t("Ebeveyn onayı")} <span className="text-sm font-normal text-cream/50">({formatNumber(pendingReview.length)})</span></h2>
              {pendingReview.length === 0 ? <EmptyMessage>{t("Onay bekleyen görev yok.")}</EmptyMessage> : (
                <ul className="mt-3 space-y-3">
                  {pendingReview.map((task) => <li key={task.id} id={`gorev-${task.id}`} className="surface scroll-mt-8">
                    <TaskSummary task={task} t={t} locale={locale} />
                    <ReviewTaskForm taskId={task.id} version={task.updatedAt.toISOString()} />
                  </li>)}
                </ul>
              )}
            </section>
          ) : null}

          <section id="gorevlerin" className="scroll-mt-8">
            <h2 className="text-lg font-bold text-cream">{t(board.admin ? "Diğer görevler" : "Görevlerin")}</h2>
            {visibleTasks.length === 0 ? (
              <EmptyMessage>{t(board.admin ? "Gösterilecek başka görev yok." : "Henüz sana atanmış görev yok.")}</EmptyMessage>
            ) : (
              <ul className="mt-3 space-y-3">
                {visibleTasks.map((task) => {
                  const editable = task.status === "OPEN" || task.status === "REJECTED";
                  const version = task.updatedAt.toISOString();
                  return (
                    <li key={task.id} id={`gorev-${task.id}`} className="surface scroll-mt-8">
                      <TaskSummary task={task} t={t} locale={locale} />
                      {task.status === "REJECTED" && task.reviewNote ? (
                        <p className="mt-3 rounded-sm bg-danger-ink px-3 py-2 text-sm text-danger">{t("Ebeveyn notu: {note}", { note: task.reviewNote })}</p>
                      ) : null}
                      {editable && task.assignedToUserId === session.user.id ? (
                        <SubmitTaskForm taskId={task.id} version={version} />
                      ) : null}
                      {board.admin && editable ? (
                        <>
                          <EditTaskForm
                            taskId={task.id}
                            version={version}
                            task={{
                              title: task.title,
                              description: task.description,
                              roomId: task.roomId,
                              assignedToUserId: task.assignedToUserId,
                              openToClaim: task.openToClaim,
                            }}
                            rooms={roomOptions}
                            members={memberOptions}
                          />
                          <CancelTaskForm taskId={task.id} version={version} />
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {!board.admin && (
            <section id="aileye-acik" className="scroll-mt-8">
              <h2 className="text-lg font-bold text-cream">{t("Aileye açık görevler")}</h2>
              {familyPool.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {familyPool.map((task) => (
                    <li key={task.id} id={`gorev-${task.id}`} className="surface scroll-mt-8">
                      <TaskSummary task={task} t={t} locale={locale} />
                      <ClaimTaskForm taskId={task.id} version={task.updatedAt.toISOString()} />
                    </li>
                  ))}
                </ul>
              ) : <EmptyMessage>{t("Şu an üstlenilebilecek görev yok.")}</EmptyMessage>}
            </section>
          )}
        </div>
        <aside aria-label={t("Görev oluşturma ve sıralama")} className="min-w-0 space-y-4">
          {board.admin && rooms.length > 0 ? (
            <section id="yeni-gorev" className="surface scroll-mt-8">
              <h2 className="mb-4 text-base font-bold text-ink">{t("Yeni görev oluştur")}</h2>
              <CreateTaskForm rooms={roomOptions} members={memberOptions} />
            </section>
          ) : null}

          {board.admin && rooms.length === 0 ? (
            <p id="yeni-gorev" className="mt-6 scroll-mt-24 rounded-sm border border-board-line/40 bg-board-deep px-4 py-3 text-sm text-cream/70">
              {t("Görev oluşturmak için önce ")}<Link href="/ev" className="underline text-gold">{t("ev haritasına bir alan ekle")}</Link>{t(".")}
            </p>
          ) : null}

          <section className="surface">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h2 className="text-base font-bold text-cream">{t("Bu haftanın sıralaması")}</h2>
              <Link href="/oduller" className="shrink-0 text-sm font-semibold text-gold underline-offset-4 hover:underline">
                {t("Haftalık ödüller")} →
              </Link>
            </div>
            <p className="mt-1 text-xs text-cream/50">{t("Pazartesi başlayan haftanın onaylı puanları")}</p>
            <ol className="mt-4 space-y-2">
              {board.leaderboard.map((entry, index) => (
                <li key={entry.userId} className={`flex items-center gap-3 rounded-sm px-3 py-2 ${entry.isCurrentUser ? "bg-board-line/30" : ""}`}>
                  <span className="w-6 text-sm font-bold text-gold">{formatNumber(index + 1)}.</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-cream">{memberNames.get(entry.userId) ?? t("İsimsiz")}{entry.isCurrentUser ? ` ${t("(sen)")}` : ""}</span>
                  <span className="text-xs text-cream/50">{t(ROLE_LABELS[entry.role])}</span>
                  <span className="font-semibold text-gold">{t("{points} p", { points: formatNumber(entry.weeklyPoints) })}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
}

function TaskSummary({ task, t, locale }: TaskTranslations & { task: {
  title: string;
  description: string | null;
  status: string;
  openToClaim: boolean;
  pointSnapshot: number | null;
  occurrenceDay: Date | null;
  room: { name: string };
  assignee: { name: string | null } | null;
  ledger: { points: number } | null;
} }) {
  return <>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-cream [overflow-wrap:anywhere]">{task.title}</p>
        <p className="mt-1 text-xs text-cream/50 [overflow-wrap:anywhere]">{task.room.name} · {task.assignee ? task.assignee.name ?? t("İsimsiz") : t(task.openToClaim ? "Aileye açık" : "Atanmamış")}</p>
      </div>
      <span className="shrink-0 rounded-sm border border-board-line/50 px-2 py-1 text-xs text-cream/70">{t(STATUS_LABELS[task.status] ?? task.status)}</span>
    </div>
    {task.occurrenceDay ? (
      <p className="mt-2 text-xs text-cream/70">{t("Tekrarlayan görev")} · {formatCalendarDay(task.occurrenceDay, locale)}</p>
    ) : null}
    {task.description ? <p className="mt-3 text-sm text-cream/70">{task.description}</p> : null}
    {task.ledger ? (
      <p className="mt-3 text-sm font-semibold text-gold">{t("Kazanılan {points} puan", { points: task.ledger.points.toLocaleString(locale) })}</p>
    ) : task.status === "COMPLETED" && task.pointSnapshot !== null ? (
      <p className="mt-3 text-sm font-semibold text-gold">{t("Onaylanırsa {points} puan", { points: task.pointSnapshot.toLocaleString(locale) })}</p>
    ) : null}
  </>;
}

function EmptyMessage({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-sm border border-board-line/30 bg-board-deep px-4 py-3 text-sm text-cream/55">{children}</p>;
}

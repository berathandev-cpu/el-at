import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getTranslations } from "@/lib/preferences";
import { getMembership, isAdminRole } from "@/lib/family";
import { getFloorPlan } from "@/lib/floor-plan";
import { listRooms } from "@/lib/rooms";
import { calculateRoomScore } from "@/lib/scoring";
import { FloorPlanCanvas } from "./floor-plan-canvas";
import { FloorPlanEditor } from "./floor-plan-editor";
import { AddRoomForm } from "./forms";
import styles from "./floor-plan.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t("Ev Haritası — El At!") };
}

const TYPE_LABELS: Record<string, string> = {
  ROOM: "Oda",
  TASK_ZONE: "Görev Bölgesi",
};

export default async function EvPage() {
  const { t, locale } = await getTranslations();
  const numbers = new Intl.NumberFormat(locale);
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/giris");
  }

  const membership = await getMembership(session.user.id);
  if (!membership) {
    redirect("/aile");
  }

  const [rooms, plan] = await Promise.all([
    listRooms(membership.familyId),
    getFloorPlan(membership.familyId),
  ]);
  const roomOptions = rooms.map(({ id, name }) => ({ id, name }));
  const isAdmin = isAdminRole(membership.role);

  return (
    <main className="panel-page">
      <header className={styles.mapHeader}>
        <div className="min-w-0">
          <p className="mb-2 break-words text-sm font-semibold text-ink-muted">{membership.family.name}</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t("Ev Haritası")}</h1>
        </div>
        <nav className={`glass-control ${styles.mapNavigation}`} aria-label={t("Ev haritası bağlantıları")}>
          <Link href="/bugun" className={styles.quietAction}>← {t("Bugün")}</Link>
          <Link href="/gorevler" className={styles.quietAction}>{t("Görev panosu")} →</Link>
        </nav>
      </header>

      <div className={styles.mapLayout}>
        <section className={`surface ${styles.workspace}`} aria-labelledby="ev-plani">
          <div className={styles.workspaceHeader}>
            <h2 id="ev-plani" className="text-xl font-extrabold">{t("Kuş bakışı plan")}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {t(isAdmin ? "Evin şeklini çiz ve odaları görev alanlarına bağla." : "Görev alanına bağlı odalara dokunarak görevleri açabilirsin.")}
            </p>
          </div>
          {isAdmin ? (
            <FloorPlanEditor
              key={membership.familyId}
              familyId={membership.familyId}
              initialShapes={plan.shapes}
              initialRevision={plan.revision}
              rooms={roomOptions}
            />
          ) : plan.shapes.length ? (
            <div className={styles.canvasFrame}>
              <FloorPlanCanvas shapes={plan.shapes} rooms={roomOptions} />
            </div>
          ) : (
            <p className={styles.blankPlan}>
              {t("Ebeveynin ev planını kaydettiğinde burada görünecek.")}
            </p>
          )}
          {(isAdmin || plan.shapes.length > 0) && (
            <ul className={styles.legend} aria-label={t("Plan göstergeleri")}>
              <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-4 bg-cream" />{t("Duvar")}</li>
              <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-3 rounded-tr-full border-t border-r border-gold" />{t("Kapı")}</li>
              <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-1.5 w-4 border-y border-current" />{t("Pencere")}</li>
              <li className={styles.scale}>{t("1 kare = 25 cm")}</li>
            </ul>
          )}
        </section>

        <aside className="min-w-0 space-y-5" aria-label={t("Görev alanları")}>
          <section className="surface" aria-labelledby="ev-alanlari">
            <h2 id="ev-alanlari" className="text-lg font-extrabold">{t("Görev alanları")}</h2>
            {rooms.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">
                {t(isAdmin ? "İlk görev alanını aşağıdan ekleyebilirsin." : "Henüz eklenmiş bir görev alanı yok.")}
              </p>
            ) : (
              <ul className={styles.roomList}>
                {rooms.map((room) => (
                  <li key={room.id}>
                    <Link
                      href={`/ev/${room.id}`}
                      className={styles.roomRow}
                    >
                      <span className="min-w-0">
                        <span className="block break-words font-semibold">{room.name}</span>
                        <span className="block text-xs text-ink-muted">{t(TYPE_LABELS[room.type])} · {t("Temel {points} p", { points: numbers.format(room.baseScore) })}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className={styles.roomPoints}>{t("{points} p", { points: numbers.format(calculateRoomScore(room).points) })}</span>
                        <span className="text-ink-muted" aria-hidden="true">›</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {isAdmin && (
            <section className="surface" aria-labelledby="yeni-alan">
              <h2 id="yeni-alan" className="text-base font-bold">{t("Yeni alan ekle")}</h2>
              <p className="mt-1 mb-4 text-sm text-ink-muted">{t("Görev ve puan vermek istediğin odaları ekle.")}</p>
              <AddRoomForm />
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

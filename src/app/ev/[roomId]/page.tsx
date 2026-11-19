import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getTranslations } from "@/lib/preferences";
import { getRoomForUser } from "@/lib/rooms";
import { calculateRoomScore } from "@/lib/scoring";

const TYPE_LABELS: Record<string, string> = {
  ROOM: "Oda",
  TASK_ZONE: "Görev Bölgesi",
};

type Params = Promise<{ roomId: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { t } = await getTranslations();
  const { roomId } = await params;
  const session = await auth();
  const room = session?.user?.id
    ? await getRoomForUser(session.user.id, roomId)
    : null;
  return { title: room ? `${room.name} — El At!` : t("Alan bulunamadı — El At!") };
}

export default async function RoomPage({ params }: { params: Params }) {
  const { t, locale } = await getTranslations();
  const { roomId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/giris");
  }

  // getRoomForUser hem "oda yok" hem "oda başka aileye ait" durumunda null
  // döner — IDOR koruması için ikisi de aynı şekilde 404 gösteriyor,
  // odanın var olup olmadığını bile sızdırmıyoruz.
  const room = await getRoomForUser(session.user.id, roomId);
  if (!room) {
    notFound();
  }

  const score = calculateRoomScore(room);
  const numbers = new Intl.NumberFormat(locale);
  const { key, days } = getCleanedStatus(room.lastCleanedAt, room.createdAt);
  const cleanedStatus = t(key, { days: numbers.format(days) });

  return (
    <main className="panel-page panel-page--reading">
      <Link href="/ev" className="text-sm text-cream/60 hover:text-cream">
        ← {t("Ev Haritası")}
      </Link>

      <div className="mt-4 rounded-sm border border-board-line/40 bg-board-deep p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">
          {t(TYPE_LABELS[room.type])}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold text-cream">{room.name}</h1>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex items-center justify-between border-t border-board-line/30 pt-3">
            <dt className="text-cream/60">{t("Şu anki görev puanı")}</dt>
            <dd className="font-semibold text-gold">{t("{points} p", { points: numbers.format(score.points) })}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-board-line/30 pt-3">
            <dt className="text-cream/60">{t("Temel puan · üst sınır")}</dt>
            <dd className="font-semibold text-cream">{t("{base} · {points} p", { base: numbers.format(room.baseScore), points: numbers.format(score.cap) })}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-board-line/30 pt-3">
            <dt className="text-cream/60">{t("Geçen tam gün")}</dt>
            <dd className="text-cream">{numbers.format(score.daysSinceCleaned)}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-board-line/30 pt-3">
            <dt className="text-cream/60">{t("Son temizlik")}</dt>
            <dd className="text-cream">{cleanedStatus}</dd>
          </div>
        </dl>
      </div>

      <Link href={`/gorevler?alan=${room.id}`} className="mt-6 flex min-h-11 items-center justify-center rounded-sm border border-gold/45 px-4 text-sm font-semibold text-gold hover:bg-board-deep">
        {t("Bu alanın görevlerini aç")}
      </Link>
    </main>
  );
}

function getCleanedStatus(lastCleanedAt: Date | null, createdAt: Date) {
  if (!lastCleanedAt) {
    const days = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return { key: "Henüz temizlenmedi", days };
    return { key: days === 1 ? "Henüz temizlenmedi · 1 gündür puan birikiyor" : "Henüz temizlenmedi · {days} gündür puan birikiyor", days };
  }

  const days = Math.floor(
    (Date.now() - lastCleanedAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days <= 0) return { key: "Bugün temizlendi", days };
  if (days === 1) return { key: "1 gün önce temizlendi", days };
  return { key: "{days} gün önce temizlendi", days };
}

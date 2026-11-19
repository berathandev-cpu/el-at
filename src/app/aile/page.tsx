import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getTranslations } from "@/lib/preferences";
import { getMembership, isAdminRole } from "@/lib/family";
import {
  AddMemberForm,
  CreateFamilyForm,
  JoinFamilyForm,
  LeaveFamilyForm,
  MemberRoleForm,
  RemoveMemberForm,
  RotateInviteCodeForm,
} from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t("Ailem — El At!") };
}

const ROLE_LABELS: Record<string, string> = {
  MOTHER: "Anne",
  FATHER: "Baba",
  CHILD: "Çocuk",
};

export default async function AilePage() {
  const { t, locale } = await getTranslations();
  const numbers = new Intl.NumberFormat(locale);
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/giris");
  }

  const membership = await getMembership(session.user.id);

  if (!membership) {
    return <FamilySetup publicId={session.user.publicId} />;
  }

  const { family, role } = membership;
  const isAdmin = isAdminRole(role);
  const parentCount = family.members.filter((member) => isAdminRole(member.role)).length;

  return (
    <main className="panel-page panel-page--reading">
      <header>
        <p className="text-sm text-cream/60">{t("Evin")}</p>
        <h1 className="mt-1 text-3xl font-extrabold text-cream">{family.name}</h1>
      </header>

      {isAdmin && <Link href="/raporlar" className="secondary-action text-sm">{t("Haftalık aile raporunu aç")}</Link>}

      {isAdmin && (
        <section className="mt-8 rounded-sm border border-board-line/50 bg-board-deep p-5">
          <h2 className="text-sm font-medium text-cream/70">{t("Davet kodu")}</h2>
          <p className="mt-2 font-mono text-2xl font-bold tracking-wider text-gold">
            {family.inviteCode}
          </p>
          <p className="mt-2 text-xs text-cream/70">
            {t("Bu kodu ailene katılacak kişilerle paylaş. Kodu yenilediğinde eski kod geçersiz olur.")}
          </p>
          <RotateInviteCodeForm />
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-medium text-cream/70">
          {t("Ev halkı ({count})", { count: numbers.format(family.members.length) })}
        </h2>
        <ul className="mt-3 space-y-2">
          {family.members.map((member) => {
            const isCurrent = member.userId === session.user.id;
            const name = member.user.name ?? t("İsimsiz");
            const canLoseAdmin = !isAdminRole(member.role) || parentCount > 1;

            return (
              <li key={member.id} className="rounded-sm border border-board-line/40 bg-board-deep px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-board-line text-sm font-bold text-cream"
                  >
                    {name.charAt(0).toLocaleUpperCase(locale)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-cream">
                      {isCurrent ? t("{name} (sen)", { name }) : name}
                    </span>
                    {(isAdmin || isCurrent) && (
                      <span className="block truncate font-mono text-xs text-cream/60">
                        {member.user.publicId}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 rounded-sm border border-gold/40 px-2 py-1 text-xs text-gold">
                    {t(ROLE_LABELS[member.role])}
                  </span>
                </div>
                {isAdmin && (
                  <details className="mt-2 border-t border-cream/15">
                    <summary className="min-h-11 cursor-pointer py-3 text-sm text-cream/90">
                      {t(isCurrent ? "Rolünü değiştir" : "Üyeyi yönet")}
                    </summary>
                    <MemberRoleForm
                      memberId={member.id}
                      memberName={name}
                      role={member.role}
                      allowChildRole={canLoseAdmin}
                    />
                    {!isCurrent && canLoseAdmin && <RemoveMemberForm memberId={member.id} />}
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {isAdmin ? (
        <section className="mt-8 rounded-sm border border-board-line/40 bg-paper p-5">
          <h2 className="text-base font-bold text-ink">{t("Kullanıcı ID ile ekle")}</h2>
          <p className="mt-1 mb-4 text-sm text-ink-muted">
            {t("Kişi uygulamaya girip kendi ID’sini sana söylesin.")}
          </p>
          <AddMemberForm />
        </section>
      ) : (
        <p className="mt-8 rounded-sm border border-board-line/40 bg-board-deep px-4 py-3 text-sm text-cream/70">
          {t("Aileye üye ekleme yetkisi anne ve babada.")}
        </p>
      )}

      {(!isAdmin || parentCount > 1) && <LeaveFamilyForm />}

      <Link href="/ben" className="secondary-action mt-8 text-sm">{t("Hesabımı yönet")}</Link>
    </main>
  );
}

async function FamilySetup({ publicId }: { publicId: string | null }) {
  const { t } = await getTranslations();
  return (
    <main className="panel-page panel-page--reading family-entry">
      <header className="text-center">
        <h1 className="text-3xl font-extrabold text-cream">{t("Aileni bağla")}</h1>
        <p className="mt-2 text-cream/70">
          {t("Ya yeni bir ev kur, ya da ailendeki birinin verdiği kodla katıl.")}
        </p>
        <Link href="/ben" className="secondary-action mt-2 text-sm">{t("Hesabımı yönet")}</Link>
      </header>

      <div className="grid items-start gap-4 sm:grid-cols-2">
      <section className="surface">
        <h2 className="text-base font-bold text-ink">{t("Yeni ev kur")}</h2>
        <p className="mt-1 mb-4 text-sm text-ink-muted">
          {t("Evi kuran kişi yönetici olur: görev oluşturur, puan verir, doğrular.")}
        </p>
        <CreateFamilyForm />
      </section>

      <section className="surface">
        <h2 className="text-base font-bold text-ink">{t("Mevcut aileye katıl")}</h2>
        <p className="mt-1 mb-4 text-sm text-ink-muted">
          {t("Ailen zaten El At! kullanıyorsa davet kodunu gir.")}
        </p>
        <JoinFamilyForm />
      </section>
      </div>

      {publicId ? (
        <p className="mt-8 rounded-sm border border-board-line/40 bg-board-deep px-4 py-3 text-center text-sm text-cream/70">
          {t("Senin Kullanıcı ID’n:")}{" "}
          <span className="font-mono text-cream">{publicId}</span>
        </p>
      ) : null}
    </main>
  );
}

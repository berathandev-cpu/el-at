import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getMembership, isAdminRole } from "@/lib/family";
import { getPreferences, getTranslations } from "@/lib/preferences";
import { PreferencesPanel } from "../preferences-panel";
import { AccountControls } from "./account-controls";
import styles from "./ben.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: `${t("Ben")} — El At!` };
}

const roleLabels = { MOTHER: "Anne", FATHER: "Baba", CHILD: "Çocuk" } as const;

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris?callbackUrl=/ben");

  const { user } = session;
  const [membership, { t, locale, language }, { theme }] = await Promise.all([
    getMembership(user.id), getTranslations(), getPreferences(),
  ]);
  const name = user.name?.trim() || t("El At! hesabı");
  const initials = user.name?.trim().split(/\s+/u).slice(0, 2)
    .map((word) => Array.from(word)[0]).join("").toLocaleUpperCase(locale);
  const needsAnotherParent = Boolean(
    membership &&
      isAdminRole(membership.role) &&
      membership.family.members.length > 1 &&
      !membership.family.members.some((member) => member.id !== membership.id && isAdminRole(member.role)),
  );

  return (
    <main className="panel-page panel-page--reading">
      <header>
        <h1 className="font-extrabold">{t("Ben")}</h1>
      </header>

      <div className={styles.sections}>
        <section className={`surface ${styles.profile}`} aria-labelledby="profile-name">
          <div className={styles.identity}>
            <span className={styles.initials} aria-hidden="true">{initials || "EA"}</span>
            <div className="min-w-0">
              <h2 id="profile-name" className={styles.name}>{name}</h2>
              {user.email && <p className={styles.detail}>{user.email}</p>}
            </div>
          </div>
          {user.publicId && (
            <dl className={styles.publicId}>
              <dt>{t("Kullanıcı kimliği")}</dt>
              <dd>{user.publicId}</dd>
            </dl>
          )}
        </section>

        <section className="surface" aria-labelledby="profile-family">
          <div className={styles.row}>
            <div className="min-w-0">
              <h2 id="profile-family" className={styles.sectionTitle}>{t("Ailem")}</h2>
              <p className={styles.detail}>
                {membership ? `${membership.family.name} · ${t(roleLabels[membership.role])}` : t("Henüz bir eve bağlı değilsin.")}
              </p>
            </div>
            <Link href="/aile" className={styles.link}>
              {t(membership ? "Ailem" : "Ev kur veya katıl")}
            </Link>
          </div>
        </section>

        <PreferencesPanel language={language} theme={theme} />
        <AccountControls expectedUserId={user.id} needsAnotherParent={needsAnotherParent} />
      </div>
    </main>
  );
}

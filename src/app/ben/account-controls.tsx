"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "@/lib/i18n-client";

import { deleteCurrentAccount, signOutCurrentAccount } from "./actions";
import styles from "./ben.module.css";

function SignOutButton() {
  const { pending } = useFormStatus();
  const { t } = useTranslations();

  return (
    <button type="submit" className={styles.link} disabled={pending} aria-busy={pending}>
      {t(pending ? "Çıkış yapılıyor…" : "Çıkış yap")}
    </button>
  );
}

export function AccountControls({
  expectedUserId,
  needsAnotherParent,
}: {
  expectedUserId: string;
  needsAnotherParent: boolean;
}) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const launch = useRef<HTMLButtonElement>(null);
  const { t } = useTranslations();

  return (
    <section className="surface" aria-labelledby="profile-account">
      <h2 id="profile-account" className={styles.sectionTitle}>{t("Hesap")}</h2>
      <div className={styles.actionRows}>
        <div className={styles.row}>
          <p className={styles.detail}>{t("Bu cihazda oturumunu kapat.")}</p>
          <form action={signOutCurrentAccount}>
            <SignOutButton />
          </form>
        </div>
        <div className={styles.row}>
          <p className={styles.detail}>{t("El At! hesabını kalıcı olarak sil.")}</p>
          <button
            ref={launch}
            type="button"
            className={styles.dangerLink}
            aria-haspopup="dialog"
            onClick={() => setShowConfirmation(true)}
          >
            {t("Hesabı sil")}
          </button>
        </div>
      </div>

      {showConfirmation && (
        <DeleteAccountDialog
          expectedUserId={expectedUserId}
          needsAnotherParent={needsAnotherParent}
          onDismiss={() => {
            setShowConfirmation(false);
            launch.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </section>
  );
}

function DeleteAccountDialog({
  expectedUserId,
  needsAnotherParent,
  onDismiss,
}: {
  expectedUserId: string;
  needsAnotherParent: boolean;
  onDismiss: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [state, action, pending] = useActionState(deleteCurrentAccount, {});
  const blocked = needsAnotherParent || state.needsAnotherParent;
  const { t } = useTranslations();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!element.open) element.showModal();
    cancel.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (state.needsAnotherParent) cancel.current?.focus({ preventScroll: true });
  }, [state.needsAnotherParent]);

  return (
    <dialog
      ref={dialog}
      className={`${styles.dialog} glass-control`}
      aria-labelledby="delete-account-title"
      aria-describedby="delete-account-description"
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      onClose={onDismiss}
    >
      <h2 id="delete-account-title" className={styles.name}>{t("Hesabını silmek istiyor musun?")}</h2>
      {blocked ? (
        <p id="delete-account-description" className={styles.dialogDescription} role={state.needsAnotherParent ? "alert" : undefined}>
          {t("Evde başka üyeler var ve tek ebeveyn sensin. Hesabını silmeden önce Ailem bölümünden başka bir yetişkine ebeveyn rolü ver.")}
        </p>
      ) : (
        <p id="delete-account-description" className={styles.dialogDescription}>{t("Bu işlem geri alınamaz.")}</p>
      )}
      {!blocked && (
        <ul className={styles.consequences}>
          <li>{t("Profil bilgilerin ve El At!’taki Google bağlantın silinir. Tüm El At! oturumların kapatılır.")}</li>
          <li>{t("Ailenin kalan görev ve puan geçmişinde adın gizlenir. Evde tek üyeysen ev ve kayıtları da silinir.")}</li>
          <li>{t("Google hesabın etkilenmez.")}</li>
        </ul>
      )}
      {state.error && !blocked && <p className={styles.error} role="alert">{t(state.error)}</p>}
      <form action={action} className={styles.dialogActions} aria-busy={pending}>
        <input type="hidden" name="intent" value="delete-self" />
        <input type="hidden" name="expectedUserId" value={expectedUserId} />
        <button ref={cancel} type="button" className={styles.dialogCancel} disabled={pending} onClick={() => dialog.current?.close()}>
          {t("Vazgeç")}
        </button>
        {blocked ? (
          <Link href="/aile" className={styles.link}>{t("Ailem’e git")}</Link>
        ) : (
          <button type="submit" className={styles.confirm} disabled={pending}>
            {t(pending ? "Hesap siliniyor…" : "Hesabımı sil")}
          </button>
        )}
      </form>
    </dialog>
  );
}

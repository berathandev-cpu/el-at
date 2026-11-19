"use client";

import { useActionState, useId } from "react";
import { useTranslations } from "@/lib/i18n-client";
import { languageOptions, type Language } from "@/lib/i18n";
import { themeOptions, type Theme } from "@/lib/preference-values";
import { savePreferences } from "./preferences-actions";
import styles from "./preferences-panel.module.css";

export function PreferencesPanel({
  language,
  theme,
  compact = false,
}: {
  language: Language;
  theme: Theme;
  compact?: boolean;
}) {
  const { t } = useTranslations();
  const titleId = useId();
  const [state, action, pending] = useActionState(savePreferences, {});
  const form = (
    <form action={action} className={styles.form} aria-busy={pending}>
      <div className={styles.fields}>
        <label>
          <span>{t("Dil")}</span>
          <select name="language" defaultValue={language} disabled={pending}>
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value} lang={option.locale}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{t("Tema")}</span>
          <select name="theme" defaultValue={theme} disabled={pending}>
            {themeOptions.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
          </select>
        </label>
      </div>
      <div className={styles.footer}>
        <button type="submit" className="primary-action" disabled={pending}>
          {pending ? t("Kaydediliyor…") : t("Kaydet")}
        </button>
        {state.error && <p role="alert" className="text-sm text-danger">{t(state.error)}</p>}
        {state.saved && <p role="status" className="text-sm text-success">{t("Tercihlerin kaydedildi.")}</p>}
      </div>
    </form>
  );

  if (compact) {
    const current = languageOptions.find((option) => option.value === language);
    return (
      <details className={styles.compact}>
        <summary>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.6 3.5 5.6 3.5 9s-1 6.4-3.5 9c-2.5-2.6-3.5-5.6-3.5-9s1-6.4 3.5-9Z" />
          </svg>
          <span>{t("Görünüm ve dil")}</span>
          <span lang={current?.locale} className={styles.currentLanguage}>{current?.label}</span>
        </summary>
        {form}
      </details>
    );
  }

  return (
    <section className="surface" aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>{t("Görünüm ve dil")}</h2>
      <p className={styles.detail}>{t("Bu tarayıcıdaki tercihlerini değiştir.")}</p>
      {form}
    </section>
  );
}

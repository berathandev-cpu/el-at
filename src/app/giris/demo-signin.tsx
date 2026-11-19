"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "@/lib/i18n-client";

function DemoButtons() {
  const { pending } = useFormStatus();
  const { t } = useTranslations();
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button type="submit" name="profile" value="parent" disabled={pending} className="min-h-11 rounded-sm bg-board px-3 text-sm font-semibold text-cream hover:bg-board-deep disabled:opacity-60">
        {t(pending ? "Açılıyor…" : "Ebeveyn olarak gir")}
      </button>
      <button type="submit" name="profile" value="child" disabled={pending} className="min-h-11 rounded-sm border border-line px-3 text-sm font-semibold text-ink hover:bg-board/5 disabled:opacity-60">
        {t(pending ? "Açılıyor…" : "Çocuk olarak gir")}
      </button>
    </div>
  );
}

export function DemoSignInForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const { t } = useTranslations();
  return (
    <form action={action}>
      <label htmlFor="demo-password" className="block text-sm font-medium text-ink">{t("Yerel demo parolası")}</label>
      <input id="demo-password" name="password" type="password" required autoComplete="current-password" className="mt-2 min-h-11 w-full rounded-sm border border-line bg-paper-raised px-4 text-ink" />
      <DemoButtons />
    </form>
  );
}

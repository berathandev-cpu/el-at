"use client";

import { useActionState, useState } from "react";

import { useTranslations } from "@/lib/i18n-client";
import { saveRewardAction } from "./actions";

export function RewardForm({ week, initialTitle }: { week: string; initialTitle: string }) {
  const { t } = useTranslations();
  const [title, setTitle] = useState(initialTitle);
  const [state, action, pending] = useActionState(saveRewardAction, {});

  return (
    <form action={action} className="mt-5 space-y-2">
      <input type="hidden" name="week" value={week} />
      <label htmlFor="reward-title" className="block text-sm font-semibold text-ink">
        {t("Ödül adı")}
      </label>
      <input
        id="reward-title"
        name="title"
        className="min-h-11 w-full rounded-sm border border-line bg-paper-raised px-3 text-ink"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
        minLength={2}
        maxLength={100}
        placeholder={t("Ör. Film gecesinin filmini seçmek")}
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-sm bg-board px-4 text-sm font-semibold text-cream hover:bg-board-deep disabled:opacity-60"
      >
        {t(pending ? "Kaydediliyor…" : "Ödülü kaydet")}
      </button>
      {state.error && <p role="alert" className="text-sm text-danger">{t(state.error)}</p>}
      {state.success && <p role="status" className="text-sm text-board">{t(state.success)}</p>}
    </form>
  );
}

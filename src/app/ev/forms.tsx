"use client";

import { useTranslations } from "@/lib/i18n-client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createRoomAction, type ActionState } from "./actions";
import { MAX_BASE_SCORE, MIN_BASE_SCORE } from "@/lib/room-constants";

const initialState: ActionState = {};

function SubmitButton() {
  const { t } = useTranslations();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-11 w-full rounded-sm bg-board px-5 text-[15px] font-semibold text-cream transition-colors hover:bg-board-deep disabled:cursor-wait disabled:opacity-70"
    >
      {t(pending ? "Ekleniyor…" : "Alanı ekle")}
    </button>
  );
}

export function AddRoomForm() {
  const { t } = useTranslations();
  const [state, formAction] = useActionState(createRoomAction, initialState);

  return (
    <form action={formAction}>
      {state.error ? (
        <p
          role="alert"
          className="mb-4 rounded-sm border border-danger/30 bg-danger-ink px-4 py-3 text-sm text-danger"
        >
          {t(state.error, state.messageArgs)}
        </p>
      ) : null}
      {state.success ? (
        <p
          role="status"
          className="mb-4 rounded-sm border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
        >
          {t(state.success, state.messageArgs)}
        </p>
      ) : null}

      <label htmlFor="room-name" className="block text-sm font-medium text-ink">
        {t("Alan adı")}
      </label>
      <input
        id="room-name"
        name="name"
        type="text"
        required
        maxLength={40}
        placeholder={t("Mutfak")}
        className="mt-2 min-h-11 w-full rounded-sm border border-line bg-paper-raised px-4 text-ink placeholder:text-ink-muted/60"
      />

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-ink">{t("Tür")}</legend>
        <div className="mt-2 flex gap-3">
          {[
            { value: "ROOM", label: "Oda" },
            { value: "TASK_ZONE", label: "Görev Bölgesi" },
          ].map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-sm border border-line bg-paper-raised px-3 text-sm text-ink has-[:checked]:border-board has-[:checked]:bg-board has-[:checked]:text-cream"
            >
              <input
                type="radio"
                name="type"
                value={option.value}
                defaultChecked={option.value === "ROOM"}
                className="sr-only"
              />
              {t(option.label)}
            </label>
          ))}
        </div>
      </fieldset>

      <label
        htmlFor="room-score"
        className="mt-5 block text-sm font-medium text-ink"
      >
        {t("Temel puan")}
      </label>
      <input
        id="room-score"
        name="baseScore"
        type="number"
        required
        inputMode="numeric"
        min={MIN_BASE_SCORE}
        max={MAX_BASE_SCORE}
        placeholder="20"
        className="mt-2 min-h-11 w-full rounded-sm border border-line bg-paper-raised px-4 text-ink placeholder:text-ink-muted/60"
      />
      <p className="mt-1 text-xs text-ink-muted">
        {t("Örnek: Koridor 10, Salon 20, Mutfak 30, Banyo 35.")}
      </p>

      <div className="mt-6">
        <SubmitButton />
      </div>
    </form>
  );
}

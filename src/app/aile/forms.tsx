"use client";

import { useTranslations } from "@/lib/i18n-client";

import type { Role } from "@prisma/client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  addMemberAction,
  changeMemberRoleAction,
  createFamilyAction,
  joinFamilyAction,
  leaveFamilyAction,
  removeMemberAction,
  rotateInviteCodeAction,
  type ActionState,
} from "./actions";

const initialState: ActionState = {};
const memberRoles = [
  { value: "MOTHER", label: "Anne" },
  { value: "FATHER", label: "Baba" },
  { value: "CHILD", label: "Çocuk" },
] as const;

function SubmitButton({ label }: { label: string }) {
  const { t } = useTranslations();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-11 w-full rounded-sm bg-board px-5 text-[15px] font-semibold text-cream transition-colors hover:bg-board-deep disabled:cursor-wait disabled:opacity-70"
    >
      {t(pending ? "Gönderiliyor…" : label)}
    </button>
  );
}

function Feedback({ state }: { state: ActionState }) {
  const { t } = useTranslations();
  if (state.error) {
    return (
      <p
        role="alert"
        className="mb-4 rounded-sm border border-danger/30 bg-danger-ink px-4 py-3 text-sm text-danger"
      >
        {t(state.error)}
      </p>
    );
  }
  if (state.success) {
    return (
      <p
        role="status"
        className="mb-4 rounded-sm border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
      >
        {t(state.success)}
      </p>
    );
  }
  return null;
}

export function CreateFamilyForm() {
  const { t } = useTranslations();
  const [state, formAction] = useActionState(createFamilyAction, initialState);

  return (
    <form action={formAction}>
      <Feedback state={state} />

      <label htmlFor="family-name" className="block text-sm font-medium text-ink">
        {t("Evinin adı")}
      </label>
      <input
        id="family-name"
        name="name"
        type="text"
        required
        maxLength={50}
        placeholder={t("Keten Ailesi")}
        className="mt-2 min-h-11 w-full rounded-sm border border-line bg-paper-raised px-4 text-ink placeholder:text-ink-muted/60"
      />

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-ink">{t("Sendeki rol")}</legend>
        <div className="mt-2 flex gap-3">
          {[
            { value: "MOTHER", label: "Anne" },
            { value: "FATHER", label: "Baba" },
          ].map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-sm border border-line bg-paper-raised px-4 text-ink has-[:checked]:border-board has-[:checked]:bg-board has-[:checked]:text-cream"
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                required
                className="sr-only"
              />
              {t(option.label)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6">
        <SubmitButton label="Evi kur" />
      </div>
    </form>
  );
}

export function JoinFamilyForm() {
  const { t } = useTranslations();
  const [state, formAction] = useActionState(joinFamilyAction, initialState);

  return (
    <form action={formAction}>
      <Feedback state={state} />

      <label htmlFor="invite-code" className="block text-sm font-medium text-ink">
        {t("Davet kodu")}
      </label>
      <input
        id="invite-code"
        name="code"
        type="text"
        required
        maxLength={40}
        placeholder="ELAT-7H29K"
        autoCapitalize="characters"
        className="mt-2 min-h-11 w-full rounded-sm border border-line bg-paper-raised px-4 font-mono text-ink placeholder:text-ink-muted/60"
      />
      <p className="mt-2 text-xs text-ink-muted">
        {t("Kodu ailendeki anne veya babadan al.")}
      </p>

      <div className="mt-6">
        <SubmitButton label="Aileye katıl" />
      </div>
    </form>
  );
}

export function AddMemberForm() {
  const { t } = useTranslations();
  const [state, formAction] = useActionState(addMemberAction, initialState);

  return (
    <form action={formAction}>
      <Feedback state={state} />

      <label htmlFor="member-id" className="block text-sm font-medium text-ink">
        {t("Kullanıcı ID")}
      </label>
      <input
        id="member-id"
        name="publicId"
        type="text"
        required
        placeholder="#ID4839201938483"
        className="mt-2 min-h-11 w-full rounded-sm border border-line bg-paper-raised px-4 font-mono text-ink placeholder:text-ink-muted/60"
      />

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-ink">{t("Rolü")}</legend>
        <div className="mt-2 flex gap-2">
          {memberRoles.map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-sm border border-line bg-paper-raised px-3 text-sm text-ink has-[:checked]:border-board has-[:checked]:bg-board has-[:checked]:text-cream"
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                required
                className="sr-only"
              />
              {t(option.label)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6">
        <SubmitButton label="Aileye ekle" />
      </div>
    </form>
  );
}

function InlineButton({ label, danger = false }: { label: string; danger?: boolean }) {
  const { t } = useTranslations();
  const { pending } = useFormStatus();
  const colors = danger
    ? "border-danger/70 text-danger-ink hover:bg-danger/30"
    : "border-cream/30 text-cream hover:bg-board-line/30";

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`min-h-11 rounded-sm border px-3 text-sm font-medium disabled:cursor-wait disabled:opacity-60 ${colors}`}
    >
      {t(pending ? "İşleniyor…" : label)}
    </button>
  );
}

export function RotateInviteCodeForm() {
  const [state, formAction] = useActionState(rotateInviteCodeAction, initialState);

  return (
    <form action={formAction} className="mt-3">
      <Feedback state={state} />
      <InlineButton label="Davet kodunu yenile" />
    </form>
  );
}

export function MemberRoleForm({
  memberId,
  memberName,
  role,
  allowChildRole,
}: {
  memberId: string;
  memberName: string;
  role: Role;
  allowChildRole: boolean;
}) {
  const { t } = useTranslations();
  const [state, formAction] = useActionState(changeMemberRoleAction, initialState);

  return (
    <form action={formAction} className="mt-3">
      <Feedback state={state} />
      <input type="hidden" name="memberId" value={memberId} />
      <label htmlFor={`role-${memberId}`} className="sr-only">{t("{name} rolü", { name: memberName })}</label>
      <div className="flex flex-wrap gap-2">
        <select
          key={role}
          id={`role-${memberId}`}
          name="role"
          defaultValue={role}
          className="min-h-11 flex-1 rounded-sm border border-cream/25 bg-board px-3 text-sm text-cream"
        >
          {memberRoles.filter((option) => allowChildRole || option.value !== "CHILD").map((option) => (
            <option key={option.value} value={option.value}>{t(option.label)}</option>
          ))}
        </select>
        <InlineButton label="Rolü kaydet" />
      </div>
    </form>
  );
}

export function RemoveMemberForm({ memberId }: { memberId: string }) {
  const { t } = useTranslations();
  const [state, formAction] = useActionState(removeMemberAction, initialState);

  return (
    <details className="mt-3 border-t border-cream/15 pt-2">
      <summary className="min-h-11 cursor-pointer py-3 text-sm text-cream/90">{t("Aileden çıkar")}</summary>
      <p className="my-2 text-sm text-cream/80">
        {t("Bu üyenin bekleyen görevleri iptal edilir, tekrarlayan görevleri duraklatılır ve davet kodu yenilenir. Onaylı görevleri ve puanları aile arşivinde kalır.")}
      </p>
      <form action={formAction}>
        <Feedback state={state} />
        <input type="hidden" name="memberId" value={memberId} />
        <InlineButton label="Üyeyi çıkar" danger />
      </form>
    </details>
  );
}

export function LeaveFamilyForm() {
  const { t } = useTranslations();
  const [state, formAction] = useActionState(leaveFamilyAction, initialState);

  return (
    <details className="mt-8 rounded-sm border border-cream/15 bg-board-deep px-4">
      <summary className="min-h-11 cursor-pointer py-3 text-sm text-cream/90">{t("Aileden ayrıl")}</summary>
      <p className="my-2 text-sm text-cream/80">
        {t("Aile panosuna erişimin kapanır. Bekleyen görevlerin iptal edilir ve tekrarlayan görevlerin duraklatılır. Onaylı görevlerin ve puanların aile arşivinde kalır.")}
      </p>
      <form action={formAction} className="pb-4">
        <Feedback state={state} />
        <InlineButton label="Aileden ayrıl" danger />
      </form>
    </details>
  );
}

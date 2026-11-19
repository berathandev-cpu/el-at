"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "@/lib/i18n-client";

import {
  cancelTaskAction,
  claimTaskAction,
  createTaskAction,
  editTaskAction,
  reviewTaskAction,
  submitTaskAction,
  type TaskActionState,
} from "./actions";
import { FAMILY_POOL_ASSIGNEE } from "./assignment";

const initialState: TaskActionState = {};

function Feedback({ state }: { state: TaskActionState }) {
  const { t, locale } = useTranslations();
  if (state.error) {
    return <p role="alert" className="mb-3 rounded-sm border border-danger/30 bg-danger-ink px-3 py-2 text-sm text-danger">{t(state.error)}</p>;
  }
  if (state.success) {
    const points = state.params?.points.toLocaleString(locale);
    return <p role="status" className="mb-3 rounded-sm border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{t(state.success, points === undefined ? undefined : { points })}</p>;
  }
  return null;
}

function PendingButton({ label, pendingLabel = "Gönderiliyor…" }: { label: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  const { t } = useTranslations();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className="min-h-11 w-full rounded-sm bg-board px-4 text-sm font-semibold text-cream hover:bg-board-deep disabled:cursor-wait disabled:opacity-70">
      {t(pending ? pendingLabel : label)}
    </button>
  );
}

type TaskOptions = {
  rooms: { id: string; name: string }[];
  members: { userId: string; name: string }[];
};

type TaskVersion = {
  taskId: string;
  version: string;
};

type TaskFieldsData = {
  title: string;
  roomId: string;
  assignedToUserId: string | null;
  description: string | null;
  openToClaim: boolean;
};

function TaskFields({
  idPrefix,
  rooms,
  members,
  task,
}: TaskOptions & {
  idPrefix: string;
  task?: TaskFieldsData;
}) {
  const { t } = useTranslations();
  const assigneeId = task?.openToClaim
    ? FAMILY_POOL_ASSIGNEE
    : members.find((member) => member.userId === task?.assignedToUserId)?.userId ?? "";
  return (
    <>
      <label htmlFor={`${idPrefix}-title`} className="block text-sm font-medium text-ink">{t("Görev")}</label>
      <input
        id={`${idPrefix}-title`}
        name="title"
        defaultValue={task?.title ?? ""}
        required
        minLength={2}
        maxLength={80}
        placeholder={t("Bulaşıkları yıka")}
        className="mt-2 min-h-11 w-full rounded-sm border border-line bg-paper-raised px-4 text-ink placeholder:text-ink-muted/60"
      />

      <label htmlFor={`${idPrefix}-room`} className="mt-4 block text-sm font-medium text-ink">{t("Alan")}</label>
      <select id={`${idPrefix}-room`} name="roomId" required defaultValue={task?.roomId ?? ""} className="mt-2 min-h-11 w-full rounded-sm border border-line bg-paper-raised px-3 text-ink">
        <option value="" disabled>{t("Bir alan seç")}</option>
        {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
      </select>

      <label htmlFor={`${idPrefix}-assignee`} className="mt-4 block text-sm font-medium text-ink">{t("Kime atanacak?")}</label>
      <select id={`${idPrefix}-assignee`} name="assignedToUserId" aria-describedby={`${idPrefix}-assignee-help`} required defaultValue={assigneeId} className="mt-2 min-h-11 w-full rounded-sm border border-line bg-paper-raised px-3 text-ink">
        <option value="" disabled>{t("Bir atama seç")}</option>
        <option value={FAMILY_POOL_ASSIGNEE}>{t("Aileye açık")}</option>
        {members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
      </select>
      <p id={`${idPrefix}-assignee-help`} className="mt-1 text-xs text-ink-muted">{t("Aileye açık bir görevi ilk seçen çocuk üstlenir.")}</p>

      <label htmlFor={`${idPrefix}-description`} className="mt-4 block text-sm font-medium text-ink">{t("Açıklama")} <span className="font-normal text-ink-muted">{t("(isteğe bağlı)")}</span></label>
      <textarea
        id={`${idPrefix}-description`}
        name="description"
        defaultValue={task?.description ?? ""}
        rows={3}
        maxLength={280}
        placeholder={t("Nasıl yapılacağını ekleyebilirsin.")}
        className="mt-2 w-full rounded-sm border border-line bg-paper-raised px-4 py-3 text-ink placeholder:text-ink-muted/60"
      />
    </>
  );
}

export function CreateTaskForm(options: TaskOptions) {
  const [state, formAction] = useActionState(createTaskAction, initialState);
  return (
    <form action={formAction}>
      <Feedback state={state} />
      <TaskFields idPrefix="task" {...options} />
      <div className="mt-5"><PendingButton label="Görevi oluştur" pendingLabel="Oluşturuluyor…" /></div>
    </form>
  );
}

function TaskVersionFields({ taskId, version }: TaskVersion) {
  return (
    <>
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="version" value={version} />
    </>
  );
}

export function EditTaskForm({
  taskId,
  version,
  task,
  ...options
}: TaskOptions & TaskVersion & { task: TaskFieldsData }) {
  const [state, formAction] = useActionState(editTaskAction, initialState);
  const { t } = useTranslations();
  return (
    <details className="mt-3 rounded-sm border border-cream/20">
      <summary className="min-h-11 cursor-pointer content-center px-3 py-2 text-sm font-medium text-cream hover:bg-board-line/30">
        {t("Görevi düzenle")}
      </summary>
      <form action={formAction} className="rounded-b-sm bg-paper p-4">
        <TaskVersionFields taskId={taskId} version={version} />
        <Feedback state={state} />
        <TaskFields key={version} idPrefix={`edit-${taskId}`} task={task} {...options} />
        <div className="mt-4"><PendingButton label="Değişiklikleri kaydet" pendingLabel="Kaydediliyor…" /></div>
      </form>
    </details>
  );
}

export function SubmitTaskForm(task: TaskVersion) {
  const [state, formAction] = useActionState(submitTaskAction, initialState);
  return (
    <form action={formAction} className="mt-4">
      <TaskVersionFields {...task} />
      <Feedback state={state} />
      <PendingButton label="Tamamlandı olarak gönder" />
    </form>
  );
}

export function ClaimTaskForm(task: TaskVersion) {
  const [state, formAction] = useActionState(claimTaskAction, initialState);
  return (
    <form action={formAction} className="mt-4">
      <TaskVersionFields {...task} />
      <Feedback state={state} />
      <PendingButton label="Görevi üstlen" pendingLabel="Üstleniliyor…" />
    </form>
  );
}

export function CancelTaskForm(task: TaskVersion) {
  const [state, formAction] = useActionState(cancelTaskAction, initialState);
  return (
    <form action={formAction} className="mt-3">
      <TaskVersionFields {...task} />
      <Feedback state={state} />
      <CancelTaskButton />
    </form>
  );
}

function CancelTaskButton() {
  const { pending } = useFormStatus();
  const { t } = useTranslations();
  return <button type="submit" disabled={pending} className="min-h-10 w-full rounded-sm border border-cream/20 px-3 text-sm text-cream/70 hover:bg-board-line/30 disabled:opacity-60">
    {t(pending ? "İptal ediliyor…" : "Görevi iptal et")}
  </button>;
}

export function ReviewTaskForm({ taskId, version }: TaskVersion) {
  const [state, formAction] = useActionState(reviewTaskAction, initialState);
  const { t } = useTranslations();
  return (
    <form action={formAction} className="mt-4">
      <TaskVersionFields taskId={taskId} version={version} />
      <Feedback state={state} />
      <label htmlFor={`review-${taskId}`} className="block text-xs font-medium text-cream/60">{t("Çocuğa not")} <span className="font-normal">{t("(isteğe bağlı)")}</span></label>
      <textarea id={`review-${taskId}`} name="reviewNote" rows={2} maxLength={200} className="mt-2 w-full rounded-sm border border-board-line/50 bg-board px-3 py-2 text-sm text-cream" />
      <ReviewButtons />
    </form>
  );
}

function ReviewButtons() {
  const { pending } = useFormStatus();
  const { t } = useTranslations();
  return <>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button type="submit" name="decision" value="approve" disabled={pending} className="min-h-11 rounded-sm bg-success/20 px-3 text-sm font-semibold text-success hover:bg-success/30 disabled:opacity-60">{t("Onayla ve puan ver")}</button>
      <button type="submit" name="decision" value="reject" disabled={pending} className="min-h-11 rounded-sm border border-danger/40 px-3 text-sm font-semibold text-danger hover:bg-danger-ink disabled:opacity-60">{t("Düzeltme iste")}</button>
    </div>
    {pending ? <p className="mt-2 text-center text-xs text-cream/50">{t("Kaydediliyor…")}</p> : null}
  </>;
}

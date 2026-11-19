"use client";

import { useActionState, useId, useState } from "react";

import { WEEKDAYS } from "@/lib/recurring-calendar";
import { useTranslations } from "@/lib/i18n-client";
import { saveRecurringRuleAction, toggleRecurringRuleAction, type RuleActionState } from "./actions";

type Option = { id: string; name: string };

export type RuleFormValues = {
  id: string;
  updatedAt: string;
  title: string;
  description: string | null;
  roomId: string;
  assignedToUserId: string;
  frequency: "DAILY" | "WEEKLY";
  weekday: number | null;
  startsOn: string;
};

const fieldClass = "mt-1 min-h-11 w-full rounded-sm border border-line bg-paper-raised px-3 py-2 text-ink";
const labelClass = "block text-sm font-semibold text-ink";
const initialState: RuleActionState = {};

function RuleFeedback({ state }: { state: RuleActionState }) {
  const { t } = useTranslations();
  return (
    <>
      {state.error && <p role="alert" className="text-sm font-medium text-danger">{t(state.error)}</p>}
      {state.success && <p role="status" className="text-sm text-board">{t(state.success)}</p>}
    </>
  );
}

export function RecurrenceForm({
  rooms,
  members,
  today,
  rule,
}: {
  rooms: Option[];
  members: Option[];
  today: string;
  rule?: RuleFormValues;
}) {
  const prefix = useId();
  const { t } = useTranslations();
  const [frequency, setFrequency] = useState(rule?.frequency ?? "DAILY");
  const [weekday, setWeekday] = useState(String(rule?.weekday ?? 1));
  const [state, action, pending] = useActionState(saveRecurringRuleAction, initialState);
  const assigneeId = members.some((member) => member.id === rule?.assignedToUserId)
    ? rule?.assignedToUserId
    : "";

  return (
    <form action={action} className="mt-4 space-y-4">
      {rule && (
        <>
          <input type="hidden" name="ruleId" value={rule.id} />
          <input type="hidden" name="updatedAt" value={rule.updatedAt} />
        </>
      )}
      <div>
        <label htmlFor={`${prefix}-title`} className={labelClass}>{t("Görev adı")}</label>
        <input
          id={`${prefix}-title`} name="title" type="text" required minLength={2} maxLength={80}
          defaultValue={rule?.title} placeholder={t("Ör. Geri dönüşümü çıkar")} className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor={`${prefix}-description`} className={labelClass}>{t("Açıklama (isteğe bağlı)")}</label>
        <textarea
          id={`${prefix}-description`} name="description" maxLength={280} rows={2}
          defaultValue={rule?.description ?? ""} className={fieldClass}
        />
      </div>
      <div className="grid gap-4 min-[400px]:grid-cols-2">
        <div>
          <label htmlFor={`${prefix}-room`} className={labelClass}>{t("Alan")}</label>
          <select id={`${prefix}-room`} name="roomId" required defaultValue={rule?.roomId ?? ""} className={fieldClass}>
            <option value="" disabled>{t("Alan seç")}</option>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${prefix}-assignee`} className={labelClass}>{t("Kime atanacak?")}</label>
          <select id={`${prefix}-assignee`} name="assignedToUserId" required defaultValue={assigneeId} className={fieldClass}>
            <option value="" disabled>{t("Üye seç")}</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${prefix}-frequency`} className={labelClass}>{t("Tekrar sıklığı")}</label>
          <select
            id={`${prefix}-frequency`} name="frequency" value={frequency} className={fieldClass}
            onChange={(event) => setFrequency(event.target.value === "WEEKLY" ? "WEEKLY" : "DAILY")}
          >
            <option value="DAILY">{t("Her gün")}</option>
            <option value="WEEKLY">{t("Haftada bir")}</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${prefix}-start`} className={labelClass}>{t("Başlangıç")}</label>
          <input
            id={`${prefix}-start`} name="startsOn" type="date" required min="2000-01-01" max="2100-12-31"
            defaultValue={rule?.startsOn ?? today} className={fieldClass}
          />
        </div>
      </div>
      {frequency === "WEEKLY" && (
        <div>
          <label htmlFor={`${prefix}-weekday`} className={labelClass}>{t("Haftanın günü")}</label>
          <select
            id={`${prefix}-weekday`} name="weekday" required value={weekday} className={fieldClass}
            onChange={(event) => setWeekday(event.target.value)}
          >
            {WEEKDAYS.map((day) => <option key={day.value} value={day.value}>{t(day.label)}</option>)}
          </select>
        </div>
      )}
      <RuleFeedback state={state} />
      <button
        type="submit" disabled={pending}
        className="min-h-11 w-full rounded-sm bg-board px-4 text-sm font-semibold text-cream hover:bg-board-deep disabled:opacity-70"
      >
        {t(pending ? "Kaydediliyor…" : rule ? "Değişiklikleri kaydet" : "Görev planı oluştur")}
      </button>
    </form>
  );
}

export function ToggleRecurringRuleForm({
  ruleId,
  updatedAt,
  active,
  canResume,
}: {
  ruleId: string;
  updatedAt: string;
  active: boolean;
  canResume: boolean;
}) {
  const [state, action, pending] = useActionState(toggleRecurringRuleAction, initialState);
  const { t } = useTranslations();
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="ruleId" value={ruleId} />
      <input type="hidden" name="updatedAt" value={updatedAt} />
      <input type="hidden" name="active" value={String(!active)} />
      <RuleFeedback state={state} />
      <button
        type="submit" disabled={pending || (!active && !canResume)}
        className="min-h-11 w-full rounded-sm border border-board/30 px-4 text-sm font-semibold text-board hover:bg-board/10 disabled:opacity-60"
      >
        {t(pending ? "Kaydediliyor…" : active ? "Duraklat" : "Yeniden başlat")}
      </button>
      {!canResume && (
        <p className="text-xs text-ink-muted">{t("Planı yeniden başlatmak için evdeki bir üyeye ata.")}</p>
      )}
    </form>
  );
}

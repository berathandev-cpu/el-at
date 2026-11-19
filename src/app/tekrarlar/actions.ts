"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { FamilyOperationError } from "@/lib/family";
import { RecurrenceError, saveRecurringRule, setRecurringRuleActive } from "@/lib/recurring-tasks";

export type RuleActionState = { error?: string; success?: string };

const versionSchema = z.object({
  id: z.string({ error: "Görev planını yenileyip tekrar dene." })
    .min(1, "Görev planını yenileyip tekrar dene.").max(100, "Görev planını yenileyip tekrar dene."),
  updatedAt: z.iso.datetime("Görev planını yenileyip tekrar dene.").transform((value) => new Date(value)),
});

const editorSchema = z.object({
  title: z.string({ error: "Görev adı en az 2 karakter olmalı." }).trim().min(2, "Görev adı en az 2 karakter olmalı.")
    .max(80, "Görev adı en fazla 80 karakter olabilir."),
  description: z.string({ error: "Görev planı bilgileri geçersiz." }).trim().max(280, "Açıklama en fazla 280 karakter olabilir."),
  roomId: z.string({ error: "Bir alan seç." }).min(1, "Bir alan seç.").max(100, "Bir alan seç."),
  assignedToUserId: z.string({ error: "Görevi bir aile üyesine ata." })
    .min(1, "Görevi bir aile üyesine ata.").max(100, "Görevi bir aile üyesine ata."),
  frequency: z.enum(["DAILY", "WEEKLY"], { error: "Geçerli bir tekrar sıklığı seç." }),
  weekday: z.enum(["1", "2", "3", "4", "5", "6", "7"], { error: "Haftalık görev için bir gün seç." }).optional(),
  startsOn: z.iso.date("Geçerli bir başlangıç tarihi seç.").refine(
    (value) => value >= "2000-01-01" && value <= "2100-12-31",
    "Başlangıç tarihi 2000 ile 2100 arasında olmalı.",
  ),
  version: versionSchema.optional(),
}).refine(
  (value) => value.frequency === "DAILY" || value.weekday !== undefined,
  "Haftalık görev için bir gün seç.",
);

const toggleSchema = versionSchema.extend({
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

async function requireActorId() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris");
  return session.user.id;
}

function revalidateRulePages() {
  revalidatePath("/tekrarlar");
  revalidatePath("/gorevler");
  revalidatePath("/bugun");
}

export async function saveRecurringRuleAction(
  _previous: RuleActionState,
  data: FormData,
): Promise<RuleActionState> {
  const actorId = await requireActorId();
  const id = data.get("ruleId");
  const updatedAt = data.get("updatedAt");
  const parsed = editorSchema.safeParse({
    title: data.get("title"),
    description: data.get("description"),
    roomId: data.get("roomId"),
    assignedToUserId: data.get("assignedToUserId"),
    frequency: data.get("frequency"),
    weekday: data.get("weekday") ?? undefined,
    startsOn: data.get("startsOn"),
    version: id !== null || updatedAt !== null ? { id, updatedAt } : undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { version, startsOn, weekday, ...rule } = parsed.data;
  try {
    await saveRecurringRule(actorId, {
      ...rule,
      startsOn: new Date(`${startsOn}T00:00:00.000Z`),
      weekday: rule.frequency === "WEEKLY" ? Number(weekday) : null,
    }, version);
  } catch (error) {
    if (error instanceof RecurrenceError || error instanceof FamilyOperationError) {
      return { error: error.message };
    }
    return { error: "Görev planı kaydedilemedi. Sayfayı yenileyip tekrar dene." };
  }
  revalidateRulePages();
  return { success: version ? "Görev planı güncellendi." : "Görev planı oluşturuldu." };
}

export async function toggleRecurringRuleAction(
  _previous: RuleActionState,
  data: FormData,
): Promise<RuleActionState> {
  const actorId = await requireActorId();
  const parsed = toggleSchema.safeParse({
    id: data.get("ruleId"),
    updatedAt: data.get("updatedAt"),
    active: data.get("active"),
  });
  if (!parsed.success) return { error: "Görev planını yenileyip tekrar dene." };

  const { active, ...version } = parsed.data;
  try {
    await setRecurringRuleActive(actorId, version, active);
  } catch (error) {
    if (error instanceof RecurrenceError || error instanceof FamilyOperationError) {
      return { error: error.message };
    }
    return { error: "Görev planının durumu değiştirilemedi." };
  }
  revalidateRulePages();
  return { success: active ? "Görev planı yeniden başladı." : "Görev planı duraklatıldı." };
}

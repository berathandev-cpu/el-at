"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { FamilyOperationError } from "@/lib/family";
import { cancelTask, claimTask, createTask, editTask, reviewTask, submitTask, TaskOperationError } from "@/lib/tasks";
import { FAMILY_POOL_ASSIGNEE } from "./assignment";

export type TaskActionState = { error?: string; success?: string; params?: { points: number } };

function taskError(error: unknown, fallback: string): TaskActionState {
  if (error instanceof TaskOperationError || error instanceof FamilyOperationError) {
    return { error: error.message };
  }
  console.error(fallback, error);
  return { error: fallback };
}

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris");
  return session.user.id;
}

const taskDetailsSchema = z.object({
  roomId: z.string({ error: "Alan seçmelisin." }).min(1, "Alan seçmelisin."),
  title: z.string({ error: "Görev adı en az 2 karakter olmalı." }).trim()
    .min(2, "Görev adı en az 2 karakter olmalı.").max(80, "Görev adı en fazla 80 karakter olabilir."),
  description: z.string({ error: "Geçersiz görev bilgileri." }).trim().max(280, "Açıklama en fazla 280 karakter olabilir."),
  assignedToUserId: z.string({ error: "Bir aile üyesi seç veya görevi aileye aç." })
    .min(1, "Bir aile üyesi seç veya görevi aileye aç."),
});

function readAssignment({ assignedToUserId, ...details }: z.infer<typeof taskDetailsSchema>) {
  return assignedToUserId === FAMILY_POOL_ASSIGNEE
    ? { ...details, assignedToUserId: null, openToClaim: true }
    : { ...details, assignedToUserId };
}

function revalidateTaskBoards() {
  revalidatePath("/gorevler");
  revalidatePath("/bugun");
}

const taskVersionSchema = z.object({
  taskId: z.string({ error: "Görev bulunamadı." }).min(1, "Görev bulunamadı."),
  version: z.iso.datetime({ message: "Görev güncel değil. Sayfayı yenile." }).transform((value) => new Date(value)),
});

function readTaskDetails(formData: FormData) {
  return {
    roomId: formData.get("roomId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    assignedToUserId: formData.get("assignedToUserId"),
  };
}

function readTaskVersion(formData: FormData) {
  return {
    taskId: formData.get("taskId"),
    version: formData.get("version"),
  };
}

export async function createTaskAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const userId = await requireUserId();
  const parsed = taskDetailsSchema.safeParse(readTaskDetails(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await createTask(userId, readAssignment(parsed.data));
  } catch (error) {
    return taskError(error, "Görev oluşturulamadı.");
  }
  revalidateTaskBoards();
  return { success: "Görev oluşturuldu." };
}

const editTaskSchema = taskVersionSchema.extend(taskDetailsSchema.shape);

export async function editTaskAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const userId = await requireUserId();
  const parsed = editTaskSchema.safeParse({
    ...readTaskVersion(formData),
    ...readTaskDetails(formData),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { taskId, version, ...details } = parsed.data;
  try {
    await editTask(userId, taskId, version, readAssignment(details));
  } catch (error) {
    return taskError(error, "Görev güncellenemedi.");
  }
  revalidateTaskBoards();
  return { success: "Görev güncellendi." };
}

export async function claimTaskAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const userId = await requireUserId();
  const parsed = taskVersionSchema.safeParse(readTaskVersion(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await claimTask(userId, parsed.data.taskId, parsed.data.version);
  } catch (error) {
    return taskError(error, "Görev üstlenilemedi.");
  }
  revalidateTaskBoards();
  return { success: "Görev artık senin listende." };
}

export async function submitTaskAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const userId = await requireUserId();
  const parsed = taskVersionSchema.safeParse(readTaskVersion(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const { points } = await submitTask(userId, parsed.data.taskId, parsed.data.version);
    revalidateTaskBoards();
    revalidatePath("/ev");
    return { success: "Tamamlandı olarak gönderildi. Onaylanırsa {points} puan kazanacaksın.", params: { points } };
  } catch (error) {
    return taskError(error, "Görev gönderilemedi.");
  }
}

export async function cancelTaskAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const userId = await requireUserId();
  const parsed = taskVersionSchema.safeParse(readTaskVersion(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await cancelTask(userId, parsed.data.taskId, parsed.data.version);
    revalidateTaskBoards();
    return { success: "Görev iptal edildi." };
  } catch (error) {
    return taskError(error, "Görev iptal edilemedi.");
  }
}

const reviewSchema = taskVersionSchema.extend({
  decision: z.enum(["approve", "reject"], { message: "Bir karar seçmelisin." }),
  reviewNote: z.string({ error: "Geçersiz görev bilgileri." }).trim().max(200, "Not en fazla 200 karakter olabilir."),
});

export async function reviewTaskAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const userId = await requireUserId();
  const parsed = reviewSchema.safeParse({
    ...readTaskVersion(formData),
    decision: formData.get("decision"),
    reviewNote: formData.get("reviewNote") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const result = await reviewTask(
      userId,
      parsed.data.taskId,
      parsed.data.version,
      parsed.data.decision === "approve" ? "APPROVED" : "REJECTED",
      parsed.data.reviewNote,
    );
    revalidateTaskBoards();
    revalidatePath("/ev");
    return result.decision === "APPROVED"
      ? { success: "Görev onaylandı, {points} puan verildi.", params: { points: result.points } }
      : { success: "Görev reddedildi. Çocuk açıklamayı görüp yeniden gönderebilir." };
  } catch (error) {
    return taskError(error, "Görev incelenemedi.");
  }
}

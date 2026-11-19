"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import {
  addMemberByPublicId,
  changeFamilyMemberRole,
  createFamily,
  FamilyOperationError,
  joinFamilyByInviteCode,
  leaveFamily,
  removeFamilyMember,
  rotateFamilyInviteCode,
} from "@/lib/family";

export type ActionState = { error?: string; success?: string };

function familyActionError(error: unknown, fallback: string): ActionState {
  if (error instanceof FamilyOperationError) return { error: error.message };
  console.error(fallback, error);
  return { error: fallback };
}

function refreshFamily() {
  revalidatePath("/aile");
  revalidatePath("/bugun");
  revalidatePath("/raporlar");
  revalidatePath("/gorevler");
  revalidatePath("/oduller");
  revalidatePath("/ev");
}

/** Her action'ın başında oturum sunucuda doğrulanıyor. */
async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/giris");
  }
  return session.user.id;
}

const createFamilySchema = z.object({
  name: z
    .string({ message: "Ev adı en az 2 karakter olmalı." })
    .trim()
    .min(2, "Ev adı en az 2 karakter olmalı.")
    .max(50, "Ev adı en fazla 50 karakter olabilir."),
  role: z.enum(["MOTHER", "FATHER"], {
    message: "Rol seçmelisin.",
  }),
});

export async function createFamilyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = createFamilySchema.safeParse({
    name: formData.get("name"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await createFamily(userId, parsed.data.name, parsed.data.role);
  } catch (error) {
    return familyActionError(error, "Ev kurulamadı.");
  }

  refreshFamily();
  redirect("/aile");
}

const joinSchema = z.object({
  code: z.string({ message: "Davet kodu boş olamaz." }).trim().min(1, "Davet kodu boş olamaz.").max(40, "Davet kodu geçersiz."),
});

export async function joinFamilyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = joinSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await joinFamilyByInviteCode(userId, parsed.data.code);
  } catch (error) {
    return familyActionError(error, "Aileye katılınamadı.");
  }

  refreshFamily();
  redirect("/aile");
}

const memberRoleSchema = z.enum(["MOTHER", "FATHER", "CHILD"], { message: "Rol seçmelisin." });
const memberIdSchema = z.string({ message: "Aile üyesi seçmelisin." }).min(1, "Aile üyesi seçmelisin.").max(64, "Aile üyesi geçersiz.");

const addMemberSchema = z.object({
  publicId: z
    .string({ message: "Kullanıcı ID formatı hatalı (örn. #ID4839201938483)." })
    .trim()
    .regex(/^#ID\d{13}$/, "Kullanıcı ID formatı hatalı (örn. #ID4839201938483)."),
  role: memberRoleSchema,
});

export async function addMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = addMemberSchema.safeParse({
    publicId: formData.get("publicId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await addMemberByPublicId(userId, parsed.data.publicId, parsed.data.role);
  } catch (error) {
    return familyActionError(error, "Üye eklenemedi.");
  }

  refreshFamily();
  return { success: "Üye aileye eklendi." };
}

const changeRoleSchema = z.object({
  memberId: memberIdSchema,
  role: memberRoleSchema,
});

export async function changeMemberRoleAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const input = changeRoleSchema.safeParse({
    memberId: formData.get("memberId"),
    role: formData.get("role"),
  });
  if (!input.success) return { error: input.error.issues[0].message };

  try {
    await changeFamilyMemberRole(userId, input.data.memberId, input.data.role);
  } catch (error) {
    return familyActionError(error, "Rol güncellenemedi.");
  }

  refreshFamily();
  return { success: "Rol güncellendi." };
}

export async function removeMemberAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const input = memberIdSchema.safeParse(formData.get("memberId"));
  if (!input.success) return { error: input.error.issues[0].message };

  try {
    await removeFamilyMember(userId, input.data);
  } catch (error) {
    return familyActionError(error, "Üye aileden çıkarılamadı.");
  }

  refreshFamily();
  return { success: "Üye çıkarıldı ve davet kodu yenilendi." };
}

export async function rotateInviteCodeAction(): Promise<ActionState> {
  const userId = await requireUserId();

  try {
    await rotateFamilyInviteCode(userId);
  } catch (error) {
    return familyActionError(error, "Davet kodu yenilenemedi.");
  }

  refreshFamily();
  return { success: "Yeni davet kodu hazır." };
}

export async function leaveFamilyAction(): Promise<ActionState> {
  const userId = await requireUserId();

  try {
    await leaveFamily(userId);
  } catch (error) {
    return familyActionError(error, "Aileden ayrılamadın.");
  }

  refreshFamily();
  redirect("/aile");
}

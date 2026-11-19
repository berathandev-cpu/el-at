"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { FamilyOperationError } from "@/lib/family";
import { createRoom, RoomOperationError } from "@/lib/rooms";
import { MAX_BASE_SCORE, MIN_BASE_SCORE } from "@/lib/room-constants";

export type ActionState = { error?: string; success?: string; messageArgs?: Record<string, string | number> };

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/giris");
  }
  return session.user.id;
}

const createRoomSchema = z.object({
  name: z
    .string({ message: "İsim en az 2 karakter olmalı." })
    .trim()
    .min(2, "İsim en az 2 karakter olmalı.")
    .max(40, "İsim en fazla 40 karakter olabilir."),
  type: z.enum(["ROOM", "TASK_ZONE"], { message: "Tür seçmelisin." }),
  baseScore: z.coerce
    .number({ message: "Puan bir sayı olmalı." })
    .int("Puan tam sayı olmalı.")
    .min(MIN_BASE_SCORE, "Puan en az {min} olmalı.")
    .max(MAX_BASE_SCORE, "Puan en fazla {max} olabilir."),
});

export async function createRoomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = createRoomSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    baseScore: formData.get("baseScore"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, messageArgs: { min: MIN_BASE_SCORE, max: MAX_BASE_SCORE } };
  }

  try {
    await createRoom(userId, parsed.data);
  } catch (error) {
    if (error instanceof RoomOperationError && error.message === `"${parsed.data.name}" adında bir alan zaten var.`) {
      return { error: "\"{name}\" adında bir alan zaten var.", messageArgs: { name: parsed.data.name } };
    }
    if (error instanceof RoomOperationError || error instanceof FamilyOperationError) {
      return { error: error.message };
    }
    console.error("Alan oluşturulamadı.", error);
    return { error: "Alan oluşturulamadı. Tekrar dene." };
  }

  revalidatePath("/ev");
  return { success: "\"{name}\" eklendi.", messageArgs: { name: parsed.data.name } };
}

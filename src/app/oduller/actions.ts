"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { FamilyOperationError } from "@/lib/family";
import { setWeeklyReward, WeeklyRewardError } from "@/lib/weekly-rewards";

export type RewardActionState = { error?: string; success?: string };

const rewardSchema = z.object({
  week: z.string({ error: "Geçerli bir ödül haftası seç." }),
  title: z.string({ error: "Ödül adı yaz." }).trim().min(2, "Ödül adı en az 2 karakter olmalı.")
    .max(100, "Ödül adı en fazla 100 karakter olabilir."),
});

export async function saveRewardAction(
  _previousState: RewardActionState,
  formData: FormData,
): Promise<RewardActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris");

  const input = rewardSchema.safeParse({ week: formData.get("week"), title: formData.get("title") });
  if (!input.success) return { error: input.error.issues[0].message };

  try {
    await setWeeklyReward(session.user.id, input.data.week, input.data.title);
  } catch (error) {
    if (error instanceof WeeklyRewardError || error instanceof FamilyOperationError) {
      return { error: error.message };
    }
    console.error("Haftalık ödül kaydedilemedi.", error);
    return { error: "Ödül kaydedilemedi. Tekrar dene." };
  }

  revalidatePath("/oduller");
  revalidatePath("/bugun");
  return { success: "Bu haftanın ödülü kaydedildi." };
}

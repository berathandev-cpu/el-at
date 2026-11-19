"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { FamilyOperationError } from "@/lib/family";
import { FloorPlanError, replaceFloorPlan } from "@/lib/floor-plan";
import { floorPlanInputSchema, type FloorPlanInput } from "@/lib/floor-plan-schema";

type SaveFloorPlanResult = { ok: true; revision: number } | { ok: false; error: string; conflict?: boolean };

export async function saveFloorPlan(input: FloorPlanInput): Promise<SaveFloorPlanResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Planı kaydetmek için yeniden giriş yap." };

  const parsed = floorPlanInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Plan kaydedilemedi. Öğe adlarını ve çizim sınırlarını kontrol et." };

  try {
    const saved = await replaceFloorPlan(session.user.id, parsed.data);
    revalidatePath("/ev");
    return { ok: true, revision: saved.revision };
  } catch (error) {
    if (error instanceof FloorPlanError) return { ok: false, error: error.message, conflict: error.conflict };
    if (error instanceof FamilyOperationError) return { ok: false, error: error.message };
    console.error("Ev planı kaydedilemedi.", error instanceof Error ? error.name : "UnknownError");
    return { ok: false, error: "Plan kaydedilemedi. Tekrar dene." };
  }
}

import { isAdminRole, withLockedFamilyMembership } from "./family";
import {
  floorPlanShapesSchema,
  type FloorPlanInput,
  type FloorPlanShape,
} from "./floor-plan-schema";
import { prisma } from "./prisma";

export class FloorPlanError extends Error {
  constructor(message: string, readonly conflict = false) {
    super(message);
  }
}

export async function getFloorPlan(familyId: string): Promise<{ shapes: FloorPlanShape[]; revision: number }> {
  const plan = await prisma.floorPlan.findUnique({ where: { familyId }, select: { shapes: true, revision: true } });
  if (!plan) return { shapes: [], revision: 0 };
  return { shapes: floorPlanShapesSchema.parse(plan.shapes), revision: plan.revision };
}

export async function replaceFloorPlan(userId: string, input: FloorPlanInput) {
  return withLockedFamilyMembership(userId, async (tx, member) => {
    if (member.familyId !== input.familyId || !isAdminRole(member.role)) {
      throw new FloorPlanError("Planı yalnızca bu ailenin ebeveynleri düzenleyebilir.");
    }

    const existing = await tx.floorPlan.findUnique({
      where: { familyId: member.familyId },
      select: { revision: true },
    });
    if ((existing?.revision ?? 0) !== input.revision) {
      throw new FloorPlanError("Bu plan başka bir oturumda güncellendi. Güncel planı açıp tekrar dene.", true);
    }

    const linkedRoomIds = new Set(input.shapes.flatMap((item) =>
      item.kind === "room" && item.roomId ? [item.roomId] : [],
    ));
    if (linkedRoomIds.size) {
      const count = await tx.room.count({ where: { familyId: member.familyId, id: { in: [...linkedRoomIds] } } });
      if (count !== linkedRoomIds.size) {
        throw new FloorPlanError("Plana yalnızca kendi ailendeki görev alanlarını bağlayabilirsin.");
      }
    }

    if (!existing) {
      return tx.floorPlan.create({
        data: { familyId: member.familyId, shapes: input.shapes },
        select: { revision: true },
      });
    }
    return tx.floorPlan.update({
      where: { familyId: member.familyId },
      data: { shapes: input.shapes, revision: { increment: 1 } },
      select: { revision: true },
    });
  });
}

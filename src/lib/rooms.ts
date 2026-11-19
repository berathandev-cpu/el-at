import type { SpaceType } from "@prisma/client";

import { prisma } from "./prisma";
import { getMembership, isAdminRole, withLockedFamilyMembership } from "./family";
import { MAX_BASE_SCORE, MIN_BASE_SCORE } from "./room-constants";

export { MIN_BASE_SCORE, MAX_BASE_SCORE };
export class RoomOperationError extends Error {}

/**
 * Doc → EV MODELİ: "Aile ev planını tanımlar." Yönetim yetkisi doc'un
 * Anne/Baba yetkileri listesinde: "Oda oluşturabilir." Çocuk'un yetkileri
 * arasında yok, bu yüzden burada da sunucuda doğruluyoruz.
 */
export async function createRoom(
  actorUserId: string,
  input: { name: string; type: SpaceType; baseScore: number },
) {
  return withLockedFamilyMembership(actorUserId, async (tx, membership) => {
    if (!isAdminRole(membership.role)) {
      throw new RoomOperationError("Oda oluşturma yetkin yok.");
    }

    const existing = await tx.room.findUnique({
      where: {
        familyId_name: { familyId: membership.familyId, name: input.name },
      },
    });
    if (existing) {
      throw new RoomOperationError(`"${input.name}" adında bir alan zaten var.`);
    }

    return tx.room.create({
      data: {
        familyId: membership.familyId,
        name: input.name,
        type: input.type,
        baseScore: input.baseScore,
      },
    });
  });
}

/** Bir ailenin tüm odalarını döner. Yetki: sadece kendi ailen. */
export async function listRooms(familyId: string) {
  return prisma.room.findMany({
    where: { familyId },
    orderBy: { name: "asc" },
  });
}

/**
 * Tek bir odayı getirir — ama yalnızca isteyen kişinin kendi ailesindeyse.
 * Doc → GÜVENLİK: IDOR kontrolü. familyId eşleşmezse oda "yokmuş" gibi
 * davranıyoruz (varlığını bile sızdırmıyoruz).
 */
export async function getRoomForUser(actorUserId: string, roomId: string) {
  const membership = await getMembership(actorUserId);
  if (!membership) return null;

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room || room.familyId !== membership.familyId) return null;

  return room;
}

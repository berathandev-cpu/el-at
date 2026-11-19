import { Prisma, type FamilyMember, type Role } from "@prisma/client";

import { lockActiveAccount } from "./account-lock";
import { prisma } from "./prisma";
import { createUniqueInviteCode, normalizeInviteCode } from "./invite-code";

/** Yönetici roller (doc: Anne ve Baba aynı yetkilere sahip). */
const ADMIN_ROLES: Role[] = ["MOTHER", "FATHER"];

export function isAdminRole(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

export class FamilyOperationError extends Error {
  constructor(message: string, readonly code?: "LAST_PARENT") {
    super(message);
  }
}

export async function lockFamily(tx: Prisma.TransactionClient, familyId: string) {
  // Membership, task and schedule changes share this lock order.
  await tx.$queryRaw`SELECT "id" FROM "families" WHERE "id" = ${familyId} FOR UPDATE`;
}

export async function withLockedFamilyMembership<T>(
  actorUserId: string,
  apply: (tx: Prisma.TransactionClient, member: FamilyMember) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const original = await tx.familyMember.findUnique({ where: { userId: actorUserId } });
    if (!original) throw new FamilyOperationError("Önce bir ev kurmalı veya aileye katılmalısın.");

    await lockFamily(tx, original.familyId);
    const member = await tx.familyMember.findUnique({ where: { id: original.id } });
    if (!member) throw new FamilyOperationError("Aile üyeliğin değişti. Sayfayı yenile.");

    return apply(tx, member);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

/** Kullanıcının ailesini ve rolünü döner; ailesi yoksa null. */
export async function getMembership(userId: string) {
  return prisma.familyMember.findUnique({
    where: { userId },
    include: {
      family: {
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, image: true, publicId: true },
              },
            },
            orderBy: { joinedAt: "asc" },
          },
        },
      },
    },
  });
}

/**
 * Yeni ev kurar ve kurucuyu yönetici olarak ekler.
 * Doc: "Kullanıcı birden fazla evde bulunamaz" — önce bu kontrol ediliyor,
 * ayrıca veritabanında da unique kısıt var (iki katmanlı koruma).
 */
export async function createFamily(
  userId: string,
  familyName: string,
  role: Extract<Role, "MOTHER" | "FATHER">,
) {
  return prisma.$transaction(async (tx) => {
    if (!await lockActiveAccount(tx, userId)) {
      throw new FamilyOperationError("Bu kullanıcı artık aktif değil.");
    }
    const existing = await tx.familyMember.findUnique({ where: { userId } });
    if (existing) {
      throw new FamilyOperationError("Zaten bir ailedesin. Önce mevcut aileden ayrılmalısın.");
    }

    const inviteCode = await createUniqueInviteCode(tx);
    return tx.family.create({
      data: {
        name: familyName,
        inviteCode,
        members: {
          create: { userId, role },
        },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

/**
 * Doc: "Anne veya Baba kullanıcıyı aileye ekler. Kullanıcı kendi kendine
 * aileye katılamaz." Bu yüzden ekleme işlemini yapan kişinin yönetici
 * olduğunu sunucuda doğruluyoruz.
 */
export async function addMemberByPublicId(
  actorUserId: string,
  targetPublicId: string,
  role: Role,
) {
  return withLockedFamilyMembership(actorUserId, async (tx, actor) => {
    if (!isAdminRole(actor.role)) {
      throw new FamilyOperationError("Aileye üye ekleme yetkin yok.");
    }

    const target = await tx.user.findUnique({
      where: { publicId: targetPublicId.trim() },
      include: { familyMembership: true },
    });
    if (!target || target.deletedAt) throw new FamilyOperationError("Bu Kullanıcı ID ile bir kişi bulunamadı.");
    if (target.familyMembership) throw new FamilyOperationError("Bu kişi zaten bir ailede.");

    return createMembership(tx, { familyId: actor.familyId, userId: target.id, role });
  });
}

/** Davet kodunu doğrular ve ailenin adını döner (katılım için ön izleme). */
export async function findFamilyByInviteCode(rawCode: string) {
  const code = normalizeInviteCode(rawCode);
  return prisma.family.findUnique({
    where: { inviteCode: code },
    select: { id: true, name: true },
  });
}

/**
 * Davet kodu ile katılım. Doc'ta "Kullanıcı kendi kendine aileye katılamaz"
 * deniyor; ancak davet kodu da bir katılım yöntemi olarak listelenmiş.
 * Bu ikisini şöyle uzlaştırdık: kodu yalnızca yönetici paylaşabildiği için
 * kod bilmek zaten yöneticinin onayı anlamına geliyor. Kodu bilen kişi
 * çocuk rolüyle katılır; yönetici rolü sonradan yalnızca bir yönetici
 * tarafından verilebilir.
 */
export async function joinFamilyByInviteCode(userId: string, rawCode: string) {
  const code = normalizeInviteCode(rawCode);
  const family = await findFamilyByInviteCode(rawCode);
  if (!family) throw new FamilyOperationError("Davet kodu geçersiz.");

  return prisma.$transaction(async (tx) => {
    await lockFamily(tx, family.id);
    const current = await tx.family.findUnique({ where: { id: family.id, inviteCode: code } });
    if (!current) throw new FamilyOperationError("Davet kodu geçersiz.");

    return createMembership(tx, { familyId: family.id, userId, role: "CHILD" });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

async function createMembership(tx: Prisma.TransactionClient, data: Prisma.FamilyMemberUncheckedCreateInput) {
  if (!await lockActiveAccount(tx, data.userId)) {
    throw new FamilyOperationError("Bu kullanıcı artık aktif değil.");
  }
  try {
    return await tx.familyMember.create({ data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new FamilyOperationError("Bu kişi zaten bir ailede.");
    }
    throw error;
  }
}

async function getFamilyMember(tx: Prisma.TransactionClient, familyId: string, memberId: string) {
  const member = await tx.familyMember.findFirst({ where: { id: memberId, familyId } });
  if (!member) throw new FamilyOperationError("Bu aile üyesi bulunamadı.");
  return member;
}

async function ensureAnotherAdministrator(tx: Prisma.TransactionClient, member: FamilyMember) {
  if (!isAdminRole(member.role)) return;

  const otherAdmin = await tx.familyMember.findFirst({
    where: {
      familyId: member.familyId,
      id: { not: member.id },
      role: { in: ADMIN_ROLES },
    },
    select: { id: true },
  });
  if (!otherAdmin) throw new FamilyOperationError("Evde en az bir anne veya baba kalmalı.", "LAST_PARENT");
}

export async function changeFamilyMemberRole(actorUserId: string, memberId: string, role: Role) {
  await withLockedFamilyMembership(actorUserId, async (tx, actor) => {
    if (!isAdminRole(actor.role)) throw new FamilyOperationError("Rolleri yalnızca ebeveyn değiştirebilir.");
    const member = await getFamilyMember(tx, actor.familyId, memberId);
    if (member.role === role) return;
    if (!isAdminRole(role)) await ensureAnotherAdministrator(tx, member);

    await tx.familyMember.update({ where: { id: member.id }, data: { role } });
  });
}

async function updateFamilyInviteCode(tx: Prisma.TransactionClient, familyId: string) {
  const inviteCode = await createUniqueInviteCode(tx);
  await tx.family.update({ where: { id: familyId }, data: { inviteCode } });
}

export async function rotateFamilyInviteCode(actorUserId: string) {
  await withLockedFamilyMembership(actorUserId, async (tx, actor) => {
    if (!isAdminRole(actor.role)) throw new FamilyOperationError("Davet kodunu yalnızca ebeveyn yenileyebilir.");
    await updateFamilyInviteCode(tx, actor.familyId);
  });
}

/** Call while holding the family lock. */
export async function endFamilyMembership(tx: Prisma.TransactionClient, member: FamilyMember) {
  await ensureAnotherAdministrator(tx, member);

  await tx.task.updateMany({
    where: {
      familyId: member.familyId,
      assignedToUserId: member.userId,
      status: { in: ["OPEN", "REJECTED", "COMPLETED"] },
    },
    data: { status: "CANCELLED" },
  });
  await tx.recurringTaskRule.updateMany({
    where: { familyId: member.familyId, assignedToUserId: member.userId, active: true },
    data: { active: false },
  });
  await updateFamilyInviteCode(tx, member.familyId);
  await tx.familyMember.delete({ where: { id: member.id } });
}

export async function removeFamilyMember(actorUserId: string, memberId: string) {
  await withLockedFamilyMembership(actorUserId, async (tx, actor) => {
    if (!isAdminRole(actor.role)) throw new FamilyOperationError("Üyeyi yalnızca ebeveyn çıkarabilir.");
    const member = await getFamilyMember(tx, actor.familyId, memberId);
    if (member.id === actor.id) throw new FamilyOperationError("Kendin için aileden ayrıl seçeneğini kullan.");
    await endFamilyMembership(tx, member);
  });
}

export async function leaveFamily(actorUserId: string) {
  await withLockedFamilyMembership(actorUserId, endFamilyMembership);
}

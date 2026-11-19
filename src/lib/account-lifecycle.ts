import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import { lockActiveAccount } from "./account-lock";
import { endFamilyMembership, FamilyOperationError, lockFamily } from "./family";
import { prisma } from "./prisma";

export class AccountDeletionError extends Error {
  constructor(readonly code: "LAST_PARENT" | "MEMBERSHIP_CHANGED", message: string) {
    super(message);
  }
}

export async function deleteOwnAccount(userId: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const completed = await prisma.$transaction(async (tx) => {
      const original = await tx.familyMember.findUnique({ where: { userId } });
      if (original) await lockFamily(tx, original.familyId);

      // Membership changes take the family lock before the account lock.
      const account = await lockActiveAccount(tx, userId);
      if (!account) return true;
      const member = await tx.familyMember.findUnique({ where: { userId } });
      if (member && member.familyId !== original?.familyId) return false;

      if (member) {
        const otherMember = await tx.familyMember.findFirst({
          where: { familyId: member.familyId, id: { not: member.id } },
          select: { id: true },
        });
        if (!otherMember) {
          await tx.family.delete({ where: { id: member.familyId } });
        } else {
          try {
            await endFamilyMembership(tx, member);
          } catch (error) {
            if (!(error instanceof FamilyOperationError) || error.code !== "LAST_PARENT") throw error;
            throw new AccountDeletionError(
              "LAST_PARENT",
              "Hesabını silmeden önce ailendeki başka bir yetişkine ebeveyn rolü ver.",
            );
          }
        }
      }

      await tx.account.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
      if (account.email) await tx.verificationToken.deleteMany({ where: { identifier: account.email } });
      await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          publicId: `deleted-${randomUUID()}`,
          name: "Silinmiş hesap",
          email: null,
          emailVerified: null,
          image: null,
          googleId: null,
        },
      });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

    if (completed) return;
  }
  throw new AccountDeletionError("MEMBERSHIP_CHANGED", "Aile üyeliğin değişti. Sayfayı yenileyip tekrar dene.");
}

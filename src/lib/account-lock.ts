import type { Prisma } from "@prisma/client";

export async function lockActiveAccount(tx: Prisma.TransactionClient, userId: string) {
  const [account] = await tx.$queryRaw<{ email: string | null }[]>`
    SELECT "email" FROM "users"
    WHERE "id" = ${userId} AND "deleted_at" IS NULL
    FOR UPDATE
  `;
  return account ?? null;
}

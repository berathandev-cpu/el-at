import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { Prisma } from "@prisma/client";
import { timingSafeEqual } from "node:crypto";

import { lockActiveAccount } from "@/lib/account-lock";
import { prisma } from "@/lib/prisma";
import { createUniquePublicId } from "@/lib/id";

const demoAuthEnabled =
  process.env.NODE_ENV === "development" &&
  process.env.AUTH_DEMO_MODE === "true" &&
  Boolean(process.env.AUTH_DEMO_PASSWORD && process.env.AUTH_DEMO_PASSWORD.length >= 16);

const DEMO_EMAILS = {
  parent: "demo-parent@elat.local",
  child: "demo-child@elat.local",
} as const;

function activeUser(user: AdapterUser | null) {
  return user && "deletedAt" in user && user.deletedAt ? null : user;
}

async function writeForActiveAccount<T>(
  userId: string,
  write: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    if (!await lockActiveAccount(tx, userId)) throw new Error("Account is inactive.");
    return write(tx);
  }, { isolationLevel: "ReadCommitted" });
}

// Sorun: Auth.js'in standart Prisma adapter'ı kullanıcıyı oluştururken
// publicId'yi bilmiyor ve boş bırakıyor. Veritabanımız bunu zorunlu tutuyor.
// Çözüm: adapter'ın createUser fonksiyonunu sarmalayıp publicId'yi
// oluşturma anında ekliyoruz.
function createAdapterWithPublicId(): Adapter {
  const base = PrismaAdapter(prisma);

  return {
    ...base,
    async createUser(data: AdapterUser): Promise<AdapterUser> {
      const publicId = await createUniquePublicId(prisma);
      const dataWithPublicId = { ...data, publicId };
      return base.createUser!(dataWithPublicId);
    },
    async getUser(id) {
      return activeUser(await base.getUser!(id));
    },
    async getUserByAccount(account) {
      return activeUser(await base.getUserByAccount!(account));
    },
    async getSessionAndUser(sessionToken) {
      const found = await base.getSessionAndUser!(sessionToken);
      return found && activeUser(found.user) ? found : null;
    },
    async deleteSession(sessionToken) {
      try {
        return (await base.deleteSession!(sessionToken)) ?? null;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
        throw error;
      }
    },
    async updateUser({ id, name, email, emailVerified, image }) {
      // The predicate is checked again if a concurrent deletion holds the row.
      return await prisma.user.update({
        where: { id, deletedAt: null },
        data: { name, email, emailVerified, image },
      }) as AdapterUser;
    },
    async createSession(session) {
      return writeForActiveAccount(session.userId, (tx) => tx.session.create({ data: session }));
    },
    async linkAccount(account) {
      await writeForActiveAccount(account.userId, (tx) => tx.account.create({
        data: {
          userId: account.userId,
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          refresh_token: account.refresh_token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          token_type: account.token_type,
          scope: account.scope,
          id_token: account.id_token,
          session_state: typeof account.session_state === "string" ? account.session_state : undefined,
        },
      }));
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createAdapterWithPublicId(),
  providers: [
    Google,
    ...(demoAuthEnabled
      ? [
          Credentials({
            id: "demo",
            name: "El At! Yerel Demo",
            credentials: {
              profile: { label: "Demo hesabı", type: "text" },
              password: { label: "Demo parolası", type: "password" },
            },
            async authorize(credentials) {
              const profile = credentials?.profile;
              const password = credentials?.password;
              const expected = process.env.AUTH_DEMO_PASSWORD;
              if (
                !demoAuthEnabled ||
                !expected ||
                typeof password !== "string" ||
                (profile !== "parent" && profile !== "child")
              ) {
                return null;
              }

              const providedBytes = Buffer.from(password);
              const expectedBytes = Buffer.from(expected);
              if (
                providedBytes.length !== expectedBytes.length ||
                !timingSafeEqual(providedBytes, expectedBytes)
              ) {
                return null;
              }

              return prisma.user.findUnique({
                where: { email: DEMO_EMAILS[profile], deletedAt: null },
              });
            },
          }),
        ]
      : []),
  ],
  session: { strategy: demoAuthEnabled ? "jwt" : "database" },
  pages: {
    signIn: "/giris",
    error: "/giris",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.publicId =
          (user as { publicId?: string | null }).publicId ?? null;
      }
      // Demo mode uses JWT sessions, which have no revocable DB session row.
      if (!token.sub || !await prisma.user.findUnique({
        where: { id: token.sub, deletedAt: null },
        select: { id: true },
      })) return null;
      return token;
    },
    async session({ session, user, token }) {
      session.user.id = user?.id ?? token?.sub ?? "";
      session.user.publicId =
        (user as { publicId?: string | null } | undefined)?.publicId ??
        (typeof token?.publicId === "string" ? token.publicId : null);
      return session;
    },
  },
  events: {
    // google_id'yi hesap bağlandıktan sonra dolduruyoruz.
    async linkAccount({ user, account }) {
      if (user.id && account.provider === "google") {
        await prisma.user.updateMany({
          where: { id: user.id, deletedAt: null },
          data: { googleId: account.providerAccountId },
        });
      }
    },
  },
});

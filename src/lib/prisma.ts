import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { getServerEnv } from "./env";

// Prisma 7'de bağlantı, Rust query engine ikilisi yerine bir driver adapter
// üzerinden kuruluyor (burada node-postgres). Bu sayede dağıtımda indirilecek
// platforma özel ikili dosya yok.
//
// Next.js dev modunda hot-reload her seferinde modülü yeniden çalıştırır;
// singleton olmadan her reload'da yeni bir PrismaClient (ve yeni bir bağlantı
// havuzu) açılır. globalThis üzerinde saklayıp tekrar kullanıyoruz.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const { DATABASE_URL } = getServerEnv();
  const adapter = new PrismaPg({ connectionString: DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

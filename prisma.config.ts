import { defineConfig } from "prisma/config";

// Prisma 7: migrate/introspect komutlarının kullandığı bağlantı bilgisi artık
// schema.prisma yerine burada. Çalışma zamanındaki bağlantı ayrı: PrismaClient
// bir driver adapter alıyor (bkz. src/lib/prisma.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

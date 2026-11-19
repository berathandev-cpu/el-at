import { z } from "zod";

/**
 * Sunucu tarafı ortam değişkeni doğrulaması. Auth.js, eksik bir env
 * değişkeniyle sessizce yanlış davranmak yerine, uygulama ayağa kalkarken
 * net bir hata vermesini istiyoruz (bkz. doc → GÜVENLİK: "Tüm doğrulamalar
 * sunucuda yapılacak").
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL tanımlı değil (Postgres bağlantısı gerekli)."),
  AUTH_SECRET: z
    .string()
    .min(1, "AUTH_SECRET tanımlı değil (`npx auth secret` ile üretebilirsin)."),
  AUTH_GOOGLE_ID: z
    .string()
    .min(1, "AUTH_GOOGLE_ID tanımlı değil (Google Cloud Console → OAuth Client ID)."),
  AUTH_GOOGLE_SECRET: z
    .string()
    .min(1, "AUTH_GOOGLE_SECRET tanımlı değil (Google Cloud Console → OAuth Client Secret)."),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

/** İlk çağrıda doğrular ve sonucu önbelleğe alır. Hata varsa süreç net bir mesajla durur. */
export function getServerEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Ortam değişkenleri eksik/geçersiz:\n${details}\n\n.env.example dosyasına bakabilirsin.`,
    );
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

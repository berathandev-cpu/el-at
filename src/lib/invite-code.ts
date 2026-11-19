import { randomInt } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

/**
 * Aileye katılım için paylaşılabilir davet kodu (bkz. doc → AİLEYE KATILIM).
 * Format: "ELAT-" + 5 karakter. Örnek: ELAT-7H29K
 *
 * Alfabede kasıtlı olarak bulunmayan karakterler: 0/O ve 1/I/L. Kod sesli
 * olarak paylaşılacağı ve elle yazılacağı için karıştırılması kolay
 * karakterler çıkarıldı.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;
const INVITE_CODE_PATTERN = /^ELAT-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `ELAT-${code}`;
}

export function isValidInviteCode(value: string): boolean {
  return INVITE_CODE_PATTERN.test(value);
}

/** Kullanıcı kodu küçük harfle veya boşlukla yazmış olabilir. */
export function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

/** Veritabanında kullanılmayan bir davet kodu üretir. */
export async function createUniqueInviteCode(
  prisma: Pick<PrismaClient, "family">,
  maxAttempts = 8,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateInviteCode();
    const existing = await prisma.family.findUnique({
      where: { inviteCode: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error("Benzersiz davet kodu üretilemedi, lütfen tekrar deneyin.");
}

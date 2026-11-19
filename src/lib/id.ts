import type { PrismaClient } from "@prisma/client";

/**
 * Kullanıcıların birbirini "Kullanıcı ID" ile aileye ekleyebilmesi için
 * (bkz. doc → AİLEYE KATILIM) her kullanıcıya ilk girişte atanan, insan
 * tarafından okunabilir benzersiz kimlik.
 *
 * Format: "#ID" + 13 haneli rastgele rakam. Örnek: #ID4839201938483
 * (doc'taki örnekle birebir aynı uzunluk).
 */
const ID_DIGIT_LENGTH = 13;
const PUBLIC_ID_PATTERN = /^#ID\d{13}$/;

/** Sadece formatı üretir, veritabanına bakmaz (saf fonksiyon → test edilebilir). */
export function generatePublicId(): string {
  const digits = Array.from({ length: ID_DIGIT_LENGTH }, () =>
    Math.floor(Math.random() * 10),
  ).join("");
  return `#ID${digits}`;
}

/** Bir string'in `#ID` + 13 hane formatına uyup uymadığını kontrol eder. */
export function isValidPublicId(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(value);
}

/**
 * Veritabanında henüz kullanılmayan bir publicId üretip döner. 13 haneli
 * rastgele uzayda çakışma ihtimali pratikte ihmal edilebilir düzeyde olsa da
 * (10^13 olasılık), yarış durumlarına karşı kontrol edip yeniden dener.
 */
export async function createUniquePublicId(
  prisma: PrismaClient,
  maxAttempts = 5,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generatePublicId();
    const existing = await prisma.user.findUnique({
      where: { publicId: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error(
    "Benzersiz kullanıcı kimliği üretilemedi, lütfen tekrar deneyin.",
  );
}

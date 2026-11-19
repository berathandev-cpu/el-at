/**
 * FAZ-1 entegrasyon kontrolü.
 *
 * Amaç: "ilk girişte benzersiz kimlik oluştur" kuralının gerçek Postgres'e
 * karşı çalıştığını doğrulamak. Google OAuth turu bu ortamda çalıştırılamadığı
 * için, Auth.js adapter'ının createUser sonrası yaptığı işi birebir taklit
 * ediyoruz: kullanıcı + google hesabı oluştur, sonra publicId/googleId doldur.
 *
 * Çalıştırma: npx tsx scripts/verify-phase1.ts
 */
import { prisma } from "../src/lib/prisma";
import { createUniquePublicId, isValidPublicId } from "../src/lib/id";

async function main() {
  const marker = `phase1-check-${Date.now()}`;
  let failed = false;

  const check = (label: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "  ✓" : "  ✗"} ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failed = true;
  };

  // 1. Adapter'ın yaptığı gibi kullanıcıyı oluştur.
  const user = await prisma.user.create({
    data: {
      email: `${marker}@example.com`,
      name: "Test Kullanıcı",
      publicId: `#ID${Date.now()}`.slice(0, 16).padEnd(16, "0"),
    },
  });

  // 2. Google hesabını bağla.
  await prisma.account.create({
    data: {
      userId: user.id,
      type: "oidc",
      provider: "google",
      providerAccountId: `google-${marker}`,
    },
  });

  // 3. src/auth.ts içindeki createUser event'inin yaptığı işin aynısı.
  const publicId = await createUniquePublicId(prisma);
  const googleAccount = await prisma.account.findFirst({
    where: { userId: user.id, provider: "google" },
    select: { providerAccountId: true },
  });
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { publicId, googleId: googleAccount?.providerAccountId },
  });

  console.log("\nFAZ-1 entegrasyon kontrolü:\n");
  check("publicId atandı", Boolean(updated.publicId), updated.publicId);
  check("publicId formatı #ID + 13 hane", isValidPublicId(updated.publicId));
  check(
    "google_id hesaptan dolduruldu",
    updated.googleId === `google-${marker}`,
    updated.googleId ?? "(boş)",
  );

  // 4. publicId benzersizliği veritabanı seviyesinde zorlanıyor mu?
  let uniqueEnforced = false;
  try {
    await prisma.user.create({
      data: { email: `${marker}-dup@example.com`, publicId: updated.publicId },
    });
  } catch {
    uniqueEnforced = true;
  }
  check("publicId benzersizliği DB'de zorlanıyor", uniqueEnforced);

  // 5. Oturum silinince kullanıcı duruyor, kullanıcı silinince hesap gidiyor
  //    (onDelete: Cascade doğru yönde mi?).
  await prisma.user.delete({ where: { id: user.id } });
  const orphanAccounts = await prisma.account.count({
    where: { providerAccountId: `google-${marker}` },
  });
  check("kullanıcı silinince hesap cascade ile siliniyor", orphanAccounts === 0);

  await prisma.user.deleteMany({ where: { email: { contains: marker } } });

  console.log(
    failed ? "\nSONUÇ: BAŞARISIZ\n" : "\nSONUÇ: tüm kontroller geçti\n",
  );
  process.exit(failed ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});

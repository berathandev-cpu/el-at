/**
 * FAZ-2 entegrasyon kontrolü — gerçek Postgres'e karşı.
 *
 * Çalıştırma: npx tsx --env-file=.env scripts/verify-phase2.ts
 */
import { prisma } from "../src/lib/prisma";
import { createUniquePublicId } from "../src/lib/id";
import {
  addMemberByPublicId,
  createFamily,
  joinFamilyByInviteCode,
} from "../src/lib/family";
import { isValidInviteCode } from "../src/lib/invite-code";

async function main() {
  const marker = `p2-${Date.now()}`;
  let failed = false;

  const check = (label: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "  ✓" : "  ✗"} ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failed = true;
  };

  const makeUser = async (suffix: string) =>
    prisma.user.create({
      data: {
        email: `${marker}-${suffix}@example.com`,
        name: `Test ${suffix}`,
        publicId: await createUniquePublicId(prisma),
      },
    });

  const anne = await makeUser("anne");
  const cocuk = await makeUser("cocuk");
  const yabanci = await makeUser("yabanci");

  console.log("\nFAZ-2 entegrasyon kontrolü:\n");

  // 1. Ev kurma
  const family = await createFamily(anne.id, "Test Ailesi", "MOTHER");
  check("ev kuruldu", Boolean(family.id));
  check("davet kodu formatı ELAT-XXXXX", isValidInviteCode(family.inviteCode), family.inviteCode);

  // 2. Kurucu yönetici olarak eklendi mi?
  const founder = await prisma.familyMember.findUnique({ where: { userId: anne.id } });
  check("kurucu MOTHER rolüyle eklendi", founder?.role === "MOTHER");

  // 3. Aynı kullanıcı ikinci ev kuramaz
  let secondFamilyBlocked = false;
  try {
    await createFamily(anne.id, "İkinci Ev", "FATHER");
  } catch {
    secondFamilyBlocked = true;
  }
  check("aynı kullanıcı ikinci ev kuramıyor", secondFamilyBlocked);

  // 4. Yönetici Kullanıcı ID ile üye ekleyebiliyor
  await addMemberByPublicId(anne.id, cocuk.publicId, "CHILD");
  const child = await prisma.familyMember.findUnique({ where: { userId: cocuk.id } });
  check("yönetici Kullanıcı ID ile üye ekledi", child?.familyId === family.id);
  check("eklenen üyenin rolü CHILD", child?.role === "CHILD");

  // 5. Çocuk üye ekleyemez (yetki kontrolü)
  let childBlocked = false;
  try {
    await addMemberByPublicId(cocuk.id, yabanci.publicId, "CHILD");
  } catch {
    childBlocked = true;
  }
  check("çocuk rolü üye EKLEYEMİYOR", childBlocked);

  // 6. Zaten ailede olan kişi tekrar eklenemez
  let duplicateBlocked = false;
  try {
    await addMemberByPublicId(anne.id, cocuk.publicId, "CHILD");
  } catch {
    duplicateBlocked = true;
  }
  check("zaten ailede olan kişi tekrar eklenemiyor", duplicateBlocked);

  // 7. Davet kodu ile katılım
  await joinFamilyByInviteCode(yabanci.id, family.inviteCode.toLowerCase());
  const joined = await prisma.familyMember.findUnique({ where: { userId: yabanci.id } });
  check("davet koduyla katılım çalışıyor (küçük harf dahil)", joined?.familyId === family.id);

  // 8. Geçersiz kod reddediliyor
  let badCodeBlocked = false;
  try {
    await joinFamilyByInviteCode((await makeUser("bad")).id, "ELAT-XXXXX");
  } catch {
    badCodeBlocked = true;
  }
  check("geçersiz davet kodu reddediliyor", badCodeBlocked);

  // 9. Veritabanı seviyesinde tek-ev kısıtı
  const otherFamily = await createFamily((await makeUser("baba2")).id, "Diğer Ev", "FATHER");
  let dbConstraintHeld = false;
  try {
    await prisma.familyMember.create({
      data: { familyId: otherFamily.id, userId: cocuk.id, role: "CHILD" },
    });
  } catch {
    dbConstraintHeld = true;
  }
  check("tek-ev kuralı VERİTABANINDA zorlanıyor", dbConstraintHeld);

  // Temizlik
  await prisma.family.deleteMany({ where: { id: { in: [family.id, otherFamily.id] } } });
  await prisma.user.deleteMany({ where: { email: { contains: marker } } });

  console.log(failed ? "\nSONUÇ: BAŞARISIZ\n" : "\nSONUÇ: tüm kontroller geçti\n");
  process.exit(failed ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});

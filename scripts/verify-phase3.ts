/**
 * FAZ-3 entegrasyon kontrolü — gerçek Postgres'e karşı.
 * Çalıştırma: npx tsx --env-file=.env scripts/verify-phase3.ts
 */
import { prisma } from "../src/lib/prisma";
import { createUniquePublicId } from "../src/lib/id";
import { createFamily } from "../src/lib/family";
import { createRoom, getRoomForUser, listRooms } from "../src/lib/rooms";

async function main() {
  const marker = `p3-${Date.now()}`;
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

  console.log("\nFAZ-3 entegrasyon kontrolü:\n");

  const anneA = await makeUser("anneA");
  const cocukA = await makeUser("cocukA");
  const familyA = await createFamily(anneA.id, "A Ailesi", "MOTHER");
  await prisma.familyMember.create({
    data: { familyId: familyA.id, userId: cocukA.id, role: "CHILD" },
  });

  const anneB = await makeUser("anneB");
  const familyB = await createFamily(anneB.id, "B Ailesi", "MOTHER");

  // 1. Yönetici oda oluşturabiliyor
  const salon = await createRoom(anneA.id, {
    name: "Salon",
    type: "ROOM",
    baseScore: 20,
  });
  check("yönetici oda oluşturdu", salon.familyId === familyA.id);
  check("last_cleaned_at başlangıçta boş", salon.lastCleanedAt === null);

  // 2. Çocuk oda oluşturamaz
  let childBlocked = false;
  try {
    await createRoom(cocukA.id, { name: "Mutfak", type: "ROOM", baseScore: 30 });
  } catch {
    childBlocked = true;
  }
  check("çocuk oda OLUŞTURAMIYOR", childBlocked);

  // 3. Aynı isimde ikinci oda reddediliyor
  let dupBlocked = false;
  try {
    await createRoom(anneA.id, { name: "Salon", type: "ROOM", baseScore: 25 });
  } catch {
    dupBlocked = true;
  }
  check("aynı isimde ikinci oda reddediliyor", dupBlocked);

  // 4. B ailesinde aynı isim serbest (izolasyon)
  const salonB = await createRoom(anneB.id, {
    name: "Salon",
    type: "ROOM",
    baseScore: 20,
  });
  check("farklı ailede aynı isim SERBEST (izolasyon)", Boolean(salonB.id));

  // 5. listRooms sadece kendi ailenin odalarını döner
  const roomsA = await listRooms(familyA.id);
  check(
    "listRooms başka ailenin odasını SIZDIRMIYOR",
    roomsA.every((r) => r.familyId === familyA.id),
  );

  // 6. IDOR: A ailesindeki çocuk, B ailesinin odasını görüntüleyemez
  const leaked = await getRoomForUser(cocukA.id, salonB.id);
  check("IDOR: başka ailenin odası görüntülenemiyor (null döner)", leaked === null);

  // 7. Kendi ailesindeki odayı herkes görebilir (çocuk dahil, salt okunur)
  const ownRoom = await getRoomForUser(cocukA.id, salon.id);
  check("aile üyesi kendi odasını görebiliyor", ownRoom?.id === salon.id);

  // 8. Puan sınırları (Zod dışında iş katmanında da mı? Hayır — bu Zod'da,
  //    burada sadece DB'nin negatif/0 gibi mantıksız değerleri kabul
  //    etmediğini kontrol etmiyoruz çünkü sınır uygulama katmanında.
  //    Burada sadece iki farklı temel puanın doğru kaydedildiğini kontrol
  //    ediyoruz.
  check("temel puan doğru kaydedildi", salon.baseScore === 20);

  // Temizlik
  await prisma.family.deleteMany({ where: { id: { in: [familyA.id, familyB.id] } } });
  await prisma.user.deleteMany({ where: { email: { contains: marker } } });

  console.log(failed ? "\nSONUÇ: BAŞARISIZ\n" : "\nSONUÇ: tüm kontroller geçti\n");
  process.exit(failed ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});

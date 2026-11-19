import { PrismaClient, type Role, type SpaceType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function uniquePublicId() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const digits = Array.from({ length: 13 }, () => Math.floor(Math.random() * 10)).join("");
    const publicId = `#ID${digits}`;
    const existing = await prisma.user.findUnique({ where: { publicId }, select: { id: true } });
    if (!existing) return publicId;
  }
  throw new Error("Could not generate a unique demo public ID.");
}

async function getOrCreateUser(email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({ data: { email, name, publicId: await uniquePublicId() } });
}

async function main() {
  const parent = await getOrCreateUser("demo-parent@elat.local", "Demo Anne");
  const child = await getOrCreateUser("demo-child@elat.local", "Demo Çocuk");

  let inviteCode = "ELAT-DEMO";
  for (let suffix = 1; await prisma.family.findUnique({ where: { inviteCode } }); suffix += 1) {
    inviteCode = `ELAT-DEMO-${suffix}`;
  }
  const family = await prisma.family.upsert({
    where: { inviteCode: "ELAT-DEMO" },
    update: { name: "El At! Demo Ailesi" },
    create: { name: "El At! Demo Ailesi", inviteCode },
  });

  const roles: { userId: string; role: Role }[] = [
    { userId: parent.id, role: "MOTHER" },
    { userId: child.id, role: "CHILD" },
  ];
  for (const member of roles) {
    await prisma.familyMember.upsert({
      where: { userId: member.userId },
      update: { familyId: family.id, role: member.role },
      create: { familyId: family.id, userId: member.userId, role: member.role },
    });
  }

  const roomSpecs: { name: string; type: SpaceType; baseScore: number }[] = [
    { name: "Mutfak", type: "ROOM", baseScore: 20 },
    { name: "Banyo", type: "ROOM", baseScore: 25 },
    { name: "Salon", type: "ROOM", baseScore: 15 },
  ];
  const rooms = new Map<string, { id: string; name: string }>();
  for (const room of roomSpecs) {
    const saved = await prisma.room.upsert({
      where: { familyId_name: { familyId: family.id, name: room.name } },
      update: { type: room.type, baseScore: room.baseScore },
      create: { familyId: family.id, ...room },
    });
    rooms.set(room.name, saved);
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const approvedTaskId = "elat-demo-approved-task";
  const approvedTask = await prisma.task.upsert({
    where: { id: approvedTaskId },
    update: {
      familyId: family.id,
      roomId: rooms.get("Salon")!.id,
      assignedToUserId: child.id,
      createdByUserId: parent.id,
      title: "Salonu süpür",
      description: "Koltuk altlarını da kontrol et.",
      status: "APPROVED",
      submittedAt: yesterday,
      pointSnapshot: 18,
      reviewedAt: now,
      reviewedByUserId: parent.id,
      reviewNote: null,
    },
    create: {
      id: approvedTaskId,
      familyId: family.id,
      roomId: rooms.get("Salon")!.id,
      assignedToUserId: child.id,
      createdByUserId: parent.id,
      title: "Salonu süpür",
      description: "Koltuk altlarını da kontrol et.",
      status: "APPROVED",
      submittedAt: yesterday,
      pointSnapshot: 18,
      reviewedAt: now,
      reviewedByUserId: parent.id,
    },
  });
  await prisma.pointLedger.upsert({
    where: { taskId: approvedTask.id },
    update: { familyId: family.id, userId: child.id, points: 18, reason: "Salon: Salonu süpür" },
    create: { familyId: family.id, userId: child.id, taskId: approvedTask.id, points: 18, reason: "Salon: Salonu süpür" },
  });

  await prisma.task.upsert({
    where: { id: "elat-demo-open-task" },
    update: {
      familyId: family.id,
      roomId: rooms.get("Mutfak")!.id,
      assignedToUserId: child.id,
      createdByUserId: parent.id,
      title: "Bulaşıkları toparla",
      description: "Bulaşık makinesini boşaltıp tezgâhı sil.",
      status: "OPEN",
      submittedAt: null,
      pointSnapshot: null,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewNote: null,
    },
    create: {
      id: "elat-demo-open-task",
      familyId: family.id,
      roomId: rooms.get("Mutfak")!.id,
      assignedToUserId: child.id,
      createdByUserId: parent.id,
      title: "Bulaşıkları toparla",
      description: "Bulaşık makinesini boşaltıp tezgâhı sil.",
    },
  });

  await prisma.task.upsert({
    where: { id: "elat-demo-review-task" },
    update: {
      familyId: family.id,
      roomId: rooms.get("Banyo")!.id,
      assignedToUserId: child.id,
      createdByUserId: parent.id,
      title: "Banyo aynasını sil",
      description: "Ayna temiz; kenarlarda iz kalmış mı bak.",
      status: "COMPLETED",
      submittedAt: now,
      pointSnapshot: 26,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewNote: null,
    },
    create: {
      id: "elat-demo-review-task",
      familyId: family.id,
      roomId: rooms.get("Banyo")!.id,
      assignedToUserId: child.id,
      createdByUserId: parent.id,
      title: "Banyo aynasını sil",
      description: "Ayna temiz; kenarlarda iz kalmış mı bak.",
      status: "COMPLETED",
      submittedAt: now,
      pointSnapshot: 26,
    },
  });

  await prisma.room.update({ where: { id: rooms.get("Salon")!.id }, data: { lastCleanedAt: yesterday } });
  console.log("Demo family ready: parent and child profiles, three rooms, and sample tasks.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

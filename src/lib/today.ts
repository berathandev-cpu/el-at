import type { Prisma } from "@prisma/client";

import { isAdminRole } from "./family";
import { getIstanbulWeek } from "./istanbul-week";
import { prisma } from "./prisma";
import { materializeRecurringTasks } from "./recurring-tasks";

const previewLimit = 4;
const taskPreview = {
  id: true,
  title: true,
  status: true,
  room: { select: { name: true } },
  assignee: { select: { name: true } },
} satisfies Prisma.TaskSelect;

export async function getToday(userId: string, now = new Date()) {
  await materializeRecurringTasks(userId, now);

  const member = await prisma.familyMember.findUnique({
    where: { userId },
    select: { familyId: true, role: true, family: { select: { name: true } } },
  });
  if (!member) return null;

  const admin = isAdminRole(member.role);
  const familyId = member.familyId;
  const scope = admin ? { familyId } : { familyId, assignedToUserId: userId };
  const { start, end } = getIstanbulWeek(now);
  const [review, rejected, open, statuses, week, reward, availableTasks] = await Promise.all([
    admin ? prisma.task.findMany({
      where: { familyId, status: "COMPLETED" },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      select: taskPreview,
      take: previewLimit,
    }) : [],
    admin ? [] : prisma.task.findMany({
      where: { ...scope, status: "REJECTED" },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      select: taskPreview,
      take: previewLimit,
    }),
    admin ? [] : prisma.task.findMany({
      where: { ...scope, status: "OPEN" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: taskPreview,
      take: previewLimit,
    }),
    prisma.task.groupBy({
      by: ["status"],
      where: { ...scope, status: { in: ["OPEN", "REJECTED", "COMPLETED"] } },
      _count: { _all: true },
    }),
    prisma.pointLedger.aggregate({
      where: { familyId, ...(admin ? {} : { userId }), createdAt: { gte: start, lt: end } },
      _sum: { points: true },
      _count: { _all: true },
    }),
    prisma.weeklyReward.findUnique({
      where: { familyId_weekStart: { familyId, weekStart: start } },
      select: { title: true },
    }),
    admin ? 0 : prisma.task.count({
      where: { familyId, assignedToUserId: null, openToClaim: true, status: "OPEN" },
    }),
  ]);
  const counts = new Map(statuses.map(({ status, _count }) => [status, _count._all]));

  return {
    admin,
    familyName: member.family.name,
    focus: admin ? review : [...rejected, ...open].slice(0, previewLimit),
    active: (counts.get("OPEN") ?? 0) + (counts.get("REJECTED") ?? 0),
    waiting: counts.get("COMPLETED") ?? 0,
    weekApproved: week._count._all,
    weekPoints: week._sum.points ?? 0,
    reward: reward?.title,
    availableTasks,
  };
}

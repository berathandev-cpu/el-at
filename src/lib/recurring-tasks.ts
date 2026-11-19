import type { Prisma, RecurringTaskFrequency } from "@prisma/client";

import { getMembership, isAdminRole, lockFamily, withLockedFamilyMembership } from "./family";
import { prisma } from "./prisma";
import { istanbulCalendarDay } from "./recurring-calendar";

export class RecurrenceError extends Error {}

export type RecurringTaskInput = {
  title: string;
  description: string;
  roomId: string;
  assignedToUserId: string;
  frequency: RecurringTaskFrequency;
  weekday: number | null;
  startsOn: Date;
};

export type RecurringRuleVersion = { id: string; updatedAt: Date };

export async function getRecurringTaskSettings(actorId: string, unnamedLabel = "İsimsiz") {
  const membership = await getMembership(actorId);
  if (!membership || !isAdminRole(membership.role)) return null;

  const familyId = membership.familyId;
  const [rooms, rules] = await Promise.all([
    prisma.room.findMany({
      where: { familyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.recurringTaskRule.findMany({
      where: { familyId },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      include: {
        room: { select: { name: true } },
        assignee: { select: { name: true } },
      },
    }),
  ]);

  const members = membership.family.members.map(({ userId, user }) => ({
    id: userId,
    name: user.name ?? unnamedLabel,
  }));

  return { rooms, rules, members };
}

async function checkAssignment(
  tx: Prisma.TransactionClient,
  familyId: string,
  roomId: string,
  assignedToUserId: string,
) {
  const [room, assignee] = await Promise.all([
    tx.room.findFirst({ where: { id: roomId, familyId }, select: { id: true } }),
    tx.familyMember.findFirst({ where: { familyId, userId: assignedToUserId }, select: { id: true } }),
  ]);
  if (!room) throw new RecurrenceError("Alanı kendi ev haritandan seç.");
  if (!assignee) throw new RecurrenceError("Görev için evdeki bir üyeyi seç.");
}

function nextRuleVersion(previous: Date) {
  return new Date(Math.max(Date.now(), previous.getTime() + 1));
}

export async function saveRecurringRule(
  actorId: string,
  input: RecurringTaskInput,
  rule?: RecurringRuleVersion,
) {
  return withLockedFamilyMembership(actorId, async (tx, membership) => {
    if (!isAdminRole(membership.role)) {
      throw new RecurrenceError("Görev planını yalnızca ebeveynler düzenleyebilir.");
    }
    const familyId = membership.familyId;
    await checkAssignment(tx, familyId, input.roomId, input.assignedToUserId);
    const data = { ...input, description: input.description || null };

    if (!rule) {
      await tx.recurringTaskRule.create({
        data: { ...data, familyId, createdByUserId: actorId },
      });
      return;
    }

    const result = await tx.recurringTaskRule.updateMany({
      where: { id: rule.id, familyId, updatedAt: rule.updatedAt },
      data: { ...data, updatedAt: nextRuleVersion(rule.updatedAt) },
    });
    if (!result.count) throw new RecurrenceError("Plan değişti. Sayfayı yenileyip tekrar dene.");
  });
}

export async function setRecurringRuleActive(
  actorId: string,
  rule: RecurringRuleVersion,
  active: boolean,
) {
  return withLockedFamilyMembership(actorId, async (tx, membership) => {
    if (!isAdminRole(membership.role)) {
      throw new RecurrenceError("Görev planını yalnızca ebeveynler düzenleyebilir.");
    }
    const familyId = membership.familyId;
    const existing = await tx.recurringTaskRule.findFirst({
      where: { id: rule.id, familyId, updatedAt: rule.updatedAt },
      select: { roomId: true, assignedToUserId: true },
    });
    if (!existing) throw new RecurrenceError("Plan değişti. Sayfayı yenileyip tekrar dene.");
    if (active) await checkAssignment(tx, familyId, existing.roomId, existing.assignedToUserId);

    await tx.recurringTaskRule.updateMany({
      where: { id: rule.id, familyId, updatedAt: rule.updatedAt },
      data: { active, updatedAt: nextRuleVersion(rule.updatedAt) },
    });
  });
}

/** Materialize only the current Istanbul day. Earlier missed days do not add a backlog. */
export async function materializeRecurringTasks(actorId: string, now = new Date()) {
  const day = istanbulCalendarDay(now);
  const weekday = day.getUTCDay() || 7;

  return prisma.$transaction(async (tx) => {
    const membership = await tx.familyMember.findUnique({
      where: { userId: actorId },
      select: { familyId: true },
    });
    if (!membership) return 0;

    const familyId = membership.familyId;
    await lockFamily(tx, familyId);
    const members = await tx.familyMember.findMany({
      where: { familyId },
      select: { userId: true },
    });
    if (!members.some((member) => member.userId === actorId)) return 0;

    const rules = await tx.recurringTaskRule.findMany({
      where: {
        familyId,
        active: true,
        startsOn: { lte: day },
        OR: [{ frequency: "DAILY" }, { frequency: "WEEKLY", weekday }],
        assignedToUserId: { in: members.map((member) => member.userId) },
        tasks: { none: { occurrenceDay: day } },
      },
      select: {
        id: true,
        roomId: true,
        title: true,
        description: true,
        assignedToUserId: true,
        createdByUserId: true,
      },
    });
    if (!rules.length) return 0;

    const result = await tx.task.createMany({
      data: rules.map(({ id, ...task }) => ({
        ...task,
        familyId,
        recurringRuleId: id,
        occurrenceDay: day,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }, { isolationLevel: "ReadCommitted" });
}

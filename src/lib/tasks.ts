import type { Prisma, Role, TaskStatus } from "@prisma/client";

import { prisma } from "./prisma";
import { getMembership, isAdminRole, withLockedFamilyMembership } from "./family";
import { getIstanbulWeek } from "./istanbul-week";
import { calculateRoomScore } from "./scoring";

export class TaskOperationError extends Error {}

export type NewTask = {
  roomId: string;
  title: string;
  description?: string | null;
  assignedToUserId?: string | null;
  openToClaim?: boolean;
};

function nextTaskVersion(version: Date) {
  // Keep successive mutations distinct even when they land in the same millisecond.
  return new Date(Math.max(Date.now(), version.getTime() + 1));
}

async function verifyTaskAssignment(tx: Prisma.TransactionClient, familyId: string, input: NewTask) {
  if (input.openToClaim && input.assignedToUserId) {
    throw new TaskOperationError("Aileye açık görev aynı anda bir kişiye atanamaz.");
  }
  const room = await tx.room.findFirst({
    where: { id: input.roomId, familyId },
    select: { id: true },
  });
  if (!room) throw new TaskOperationError("Bu alan bulunamadı.");

  if (input.assignedToUserId) {
    const assignee = await tx.familyMember.findFirst({
      where: { familyId, userId: input.assignedToUserId },
      select: { userId: true },
    });
    if (!assignee) throw new TaskOperationError("Görev yalnızca aynı evdeki bir üyeye atanabilir.");
  }

  return {
    roomId: room.id,
    title: input.title,
    description: input.description || null,
    assignedToUserId: input.assignedToUserId || null,
    openToClaim: input.openToClaim ?? false,
  };
}

export async function createTask(actorUserId: string, input: NewTask) {
  return withLockedFamilyMembership(actorUserId, async (tx, membership) => {
    if (!isAdminRole(membership.role)) throw new TaskOperationError("Görev oluşturma yetkin yok.");

    const assignment = await verifyTaskAssignment(tx, membership.familyId, input);
    return tx.task.create({
      data: {
        ...assignment,
        familyId: membership.familyId,
        createdByUserId: actorUserId,
      },
    });
  });
}

export async function editTask(
  actorUserId: string,
  taskId: string,
  expectedVersion: Date,
  input: NewTask,
) {
  return withLockedFamilyMembership(actorUserId, async (tx, membership) => {
    if (!isAdminRole(membership.role)) throw new TaskOperationError("Görev düzenleme yetkin yok.");

    const assignment = await verifyTaskAssignment(tx, membership.familyId, input);
    const changed = await tx.task.updateMany({
      where: {
        id: taskId,
        familyId: membership.familyId,
        updatedAt: expectedVersion,
        status: { in: ["OPEN", "REJECTED"] },
      },
      data: {
        ...assignment,
        ...(assignment.openToClaim ? {
          status: "OPEN",
          submittedAt: null,
          pointSnapshot: null,
          reviewedAt: null,
          reviewedByUserId: null,
          reviewNote: null,
        } : {}),
        updatedAt: nextTaskVersion(expectedVersion),
      },
    });
    if (changed.count !== 1) {
      throw new TaskOperationError("Görev değişti veya artık düzenlenemiyor. Sayfayı yenileyip tekrar dene.");
    }
  });
}

export async function claimTask(actorUserId: string, taskId: string, expectedVersion: Date) {
  return withLockedFamilyMembership(actorUserId, async (tx, membership) => {
    if (membership.role !== "CHILD") {
      throw new TaskOperationError("Aileye açık görevleri çocuk üyeler üstlenebilir.");
    }

    const changed = await tx.task.updateMany({
      where: {
        id: taskId,
        familyId: membership.familyId,
        status: "OPEN",
        openToClaim: true,
        assignedToUserId: null,
        updatedAt: expectedVersion,
      },
      data: {
        assignedToUserId: actorUserId,
        openToClaim: false,
        updatedAt: nextTaskVersion(expectedVersion),
      },
    });
    if (changed.count !== 1) {
      throw new TaskOperationError("Görev artık üstlenilemiyor veya değişti. Panoyu yenileyip tekrar kontrol et.");
    }
  });
}

export async function submitTask(actorUserId: string, taskId: string, expectedVersion: Date) {
  return withLockedFamilyMembership(actorUserId, async (tx, membership) => {
    const task = await tx.task.findFirst({
      where: { id: taskId, familyId: membership.familyId },
      include: { room: true },
    });

    if (!task) throw new TaskOperationError("Görev bulunamadı.");
    if (task.assignedToUserId !== actorUserId) throw new TaskOperationError("Bu görevi tamamlama yetkin yok.");
    if (task.status !== "OPEN" && task.status !== "REJECTED") {
      throw new TaskOperationError("Bu görev şu anda tamamlanmaya gönderilemez.");
    }
    if (task.updatedAt.getTime() !== expectedVersion.getTime()) {
      throw new TaskOperationError("Görev değişti. Sayfayı yenileyip güncel görevi kontrol et.");
    }

    const submittedAt = new Date();
    const { points } = calculateRoomScore(task.room, submittedAt);
    const changed = await tx.task.updateMany({
      where: {
        id: task.id,
        familyId: membership.familyId,
        status: task.status,
        assignedToUserId: actorUserId,
        updatedAt: expectedVersion,
      },
      data: {
        status: "COMPLETED",
        updatedAt: nextTaskVersion(expectedVersion),
        submittedAt,
        pointSnapshot: points,
        reviewedAt: null,
        reviewedByUserId: null,
        reviewNote: null,
      },
    });
    if (changed.count !== 1) throw new TaskOperationError("Görev aynı anda değişti. Yenileyip tekrar dene.");
    return { points };
  });
}

/** A parent can close an unstarted or returned task before it earns points. */
export async function cancelTask(actorUserId: string, taskId: string, expectedVersion: Date) {
  return withLockedFamilyMembership(actorUserId, async (tx, membership) => {
    if (!isAdminRole(membership.role)) throw new TaskOperationError("Görev iptal etme yetkin yok.");

    const changed = await tx.task.updateMany({
      where: {
        id: taskId,
        familyId: membership.familyId,
        updatedAt: expectedVersion,
        status: { in: ["OPEN", "REJECTED"] },
      },
      data: { status: "CANCELLED", openToClaim: false, updatedAt: nextTaskVersion(expectedVersion) },
    });
    if (changed.count !== 1) {
      throw new TaskOperationError("Görev değişti veya artık iptal edilemiyor. Sayfayı yenileyip tekrar dene.");
    }
  });
}

export async function reviewTask(
  actorUserId: string,
  taskId: string,
  expectedVersion: Date,
  decision: Extract<TaskStatus, "APPROVED" | "REJECTED">,
  reviewNote?: string | null,
) {
  return withLockedFamilyMembership(actorUserId, async (tx, membership) => {
    if (!isAdminRole(membership.role)) throw new TaskOperationError("Görev doğrulama yetkin yok.");
    const task = await tx.task.findFirst({
      where: { id: taskId, familyId: membership.familyId },
      include: { room: true },
    });
    if (!task) throw new TaskOperationError("Görev bulunamadı.");
    if (task.status !== "COMPLETED") throw new TaskOperationError("Yalnızca tamamlanması gönderilen görevler incelenebilir.");
    if (!task.assignedToUserId) throw new TaskOperationError("Bu görev bir aile üyesine atanmamış.");
    const assignee = await tx.familyMember.findUnique({ where: { userId: task.assignedToUserId } });
    if (assignee?.familyId !== membership.familyId) {
      throw new TaskOperationError("Bu görevin atandığı kişi artık ailede değil.");
    }
    if (task.updatedAt.getTime() !== expectedVersion.getTime()) {
      throw new TaskOperationError("Görev değişti. Sayfayı yenileyip güncel gönderimi kontrol et.");
    }

    const reviewedAt = new Date();
    const changed = await tx.task.updateMany({
      where: { id: task.id, familyId: membership.familyId, status: "COMPLETED", updatedAt: expectedVersion },
      data: {
        status: decision,
        updatedAt: nextTaskVersion(expectedVersion),
        reviewedAt,
        reviewedByUserId: actorUserId,
        reviewNote: reviewNote || null,
      },
    });
    if (changed.count !== 1) throw new TaskOperationError("Görev aynı anda incelendi. Sayfayı yenile.");

    if (decision === "REJECTED") return { decision, points: 0 };

    const points = task.pointSnapshot ?? calculateRoomScore(task.room, task.submittedAt ?? reviewedAt).points;
    await tx.pointLedger.create({
      data: {
        familyId: membership.familyId,
        userId: task.assignedToUserId,
        taskId: task.id,
        points,
        reason: `${task.room.name}: ${task.title}`,
        createdAt: reviewedAt,
      },
    });
    const cleanedAt = task.submittedAt ?? reviewedAt;
    await tx.room.updateMany({
      where: {
        id: task.roomId,
        familyId: membership.familyId,
        OR: [{ lastCleanedAt: null }, { lastCleanedAt: { lt: cleanedAt } }],
      },
      data: { lastCleanedAt: cleanedAt },
    });

    return { decision, points };
  });
}

export async function getTaskBoard(actorUserId: string, now = new Date()) {
  const membership = await getMembership(actorUserId);
  if (!membership) return null;
  const admin = isAdminRole(membership.role);
  const { start, end } = getIstanbulWeek(now);
  const where: Prisma.TaskWhereInput = admin
    ? { familyId: membership.familyId }
    : {
        familyId: membership.familyId,
        OR: [
          { assignedToUserId: actorUserId },
          { status: "OPEN", openToClaim: true, assignedToUserId: null },
        ],
      };

  const [tasks, lifetime, weekly] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        room: { select: { id: true, name: true, type: true } },
        assignee: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
        ledger: { select: { points: true, createdAt: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.pointLedger.groupBy({
      by: ["userId"],
      where: { familyId: membership.familyId },
      _sum: { points: true },
    }),
    prisma.pointLedger.groupBy({
      by: ["userId"],
      where: { familyId: membership.familyId, createdAt: { gte: start, lt: end } },
      _sum: { points: true },
    }),
  ]);

  const lifetimeByUser = new Map(lifetime.map((row) => [row.userId, row._sum.points ?? 0]));
  const weeklyByUser = new Map(weekly.map((row) => [row.userId, row._sum.points ?? 0]));
  const leaderboard = membership.family.members
    .map((member) => ({
      userId: member.userId,
      name: member.user.name ?? "İsimsiz",
      role: member.role as Role,
      weeklyPoints: weeklyByUser.get(member.userId) ?? 0,
      totalPoints: lifetimeByUser.get(member.userId) ?? 0,
      isCurrentUser: member.userId === actorUserId,
    }))
    .sort((a, b) => b.weeklyPoints - a.weeklyPoints || b.totalPoints - a.totalPoints || a.name.localeCompare(b.name, "tr"));

  return { membership, admin, tasks, leaderboard };
}

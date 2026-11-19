import { Prisma } from "@prisma/client";

import { isAdminRole } from "./family";
import { createTranslator, getLocale, type Language } from "./i18n";
import { getIstanbulWeek } from "./istanbul-week";
import { prisma } from "./prisma";
import { asCalendarInput, istanbulCalendarDay } from "./recurring-calendar";

type ReportEntry = {
  id: string;
  earnedAt: Date;
  userId: string;
  person: string;
  task: string;
  room: string;
  points: number;
};

type Contribution = Pick<ReportEntry, "userId" | "person" | "points"> & { count: number };

function approvalDateFormat(locale: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Istanbul",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function weekKey(start: Date) {
  return asCalendarInput(istanbulCalendarDay(start));
}

function selectWeek(requestedWeek: string | undefined, current: ReturnType<typeof getIstanbulWeek>) {
  if (requestedWeek === undefined) return current;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedWeek)) return null;

  const date = new Date(`${requestedWeek}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || asCalendarInput(date) !== requestedWeek || date.getUTCDay() !== 1) {
    return null;
  }
  const week = getIstanbulWeek(date);
  return weekKey(week.start) === requestedWeek ? week : null;
}

export async function getFamilyReport(
  actorId: string,
  requestedWeek?: string,
  now = new Date(),
  language: Language = "tr",
) {
  const t = createTranslator(language);
  const names = new Intl.Collator(getLocale(language));
  return prisma.$transaction(async (tx) => {
    const member = await tx.familyMember.findUnique({
      where: { userId: actorId },
      select: { role: true, family: { select: { id: true, name: true, createdAt: true } } },
    });
    if (!member) return { status: "no-family" } as const;
    if (!isAdminRole(member.role)) return { status: "forbidden" } as const;

    const { family } = member;
    const current = getIstanbulWeek(now);
    const first = getIstanbulWeek(family.createdAt).start;
    const week = selectWeek(requestedWeek, current);
    if (!week || week.start < first || week.start > current.start) {
      return { status: "invalid-week" } as const;
    }

    const ledger = await tx.pointLedger.findMany({
      where: { familyId: family.id, createdAt: { gte: week.start, lt: week.end } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        createdAt: true,
        points: true,
        userId: true,
        user: { select: { name: true, deletedAt: true } },
        task: { select: { title: true, room: { select: { name: true } } } },
      },
    });
    const reward = await tx.weeklyReward.findUnique({
      where: { familyId_weekStart: { familyId: family.id, weekStart: week.start } },
      select: { title: true },
    });

    const entries: ReportEntry[] = [];
    const totalsByMember = new Map<string, Contribution>();
    let totalPoints = 0;
    for (const item of ledger) {
      const person = item.user.deletedAt ? t("Silinmiş hesap") : item.user.name || t("İsimsiz üye");
      entries.push({
        id: item.id,
        earnedAt: item.createdAt,
        userId: item.userId,
        person,
        task: item.task.title,
        room: item.task.room.name,
        points: item.points,
      });
      const contribution = totalsByMember.get(item.userId);
      if (contribution) {
        contribution.points += item.points;
        contribution.count += 1;
      } else {
        totalsByMember.set(item.userId, { userId: item.userId, person, points: item.points, count: 1 });
      }
      totalPoints += item.points;
    }

    const contributions = [...totalsByMember.values()].sort((a, b) =>
      b.points - a.points || names.compare(a.person, b.person) || a.userId.localeCompare(b.userId),
    );
    const topScore = contributions[0]?.points ?? 0;
    const leaders = topScore > 0 ? contributions.filter((member) => member.points === topScore) : [];
    const isCurrent = week.start.getTime() === current.start.getTime();

    return {
      status: "ready",
      familyName: family.name,
      week,
      key: weekKey(week.start),
      previousKey: week.start > first ? weekKey(getIstanbulWeek(new Date(week.start.getTime() - 1)).start) : null,
      nextKey: isCurrent ? null : weekKey(week.end),
      isCurrent,
      reward,
      entries,
      contributions,
      leaders,
      totalPoints,
    } as const;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export function formatApprovalDate(date: Date, locale = "tr-TR") {
  return approvalDateFormat(locale).format(date);
}

function csvCell(value: string) {
  // Neutralize spreadsheet formulas even when preceded by whitespace or invisible formatting characters.
  const formula = /^[\p{White_Space}\p{Cf}]*[=+@＝＋－＠-]|^[\t\r\n]/u.test(value);
  return `"${(formula ? `'${value}` : value).replaceAll('"', '""')}"`;
}

export function familyReportCsv(entries: readonly ReportEntry[], language: Language = "tr") {
  const t = createTranslator(language);
  const approvalDate = approvalDateFormat(getLocale(language));
  const header = ["Onay zamanı (İstanbul)", "Üye", "Görev", "Alan"].map((label) => csvCell(t(label))).join(";");
  const rows = entries.map((entry) => [
    approvalDate.format(entry.earnedAt), entry.person, entry.task, entry.room,
  ].map(csvCell).join(";") + `;${entry.points}`);
  return `\uFEFF${[`${header};${t("Puan")}`, ...rows].join("\r\n")}\r\n`;
}

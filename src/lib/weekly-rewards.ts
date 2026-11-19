import { getMembership, isAdminRole, withLockedFamilyMembership } from "./family";
import { createTranslator, getLocale, type Language } from "./i18n";
import { getIstanbulWeek } from "./istanbul-week";
import { prisma } from "./prisma";

export class WeeklyRewardError extends Error {}

export async function setWeeklyReward(actorId: string, weekKey: string, title: string) {
  return withLockedFamilyMembership(actorId, async (tx, member) => {
    if (!isAdminRole(member.role)) {
      throw new WeeklyRewardError("Haftalık ödülü yalnızca anne veya baba belirleyebilir.");
    }

    const { start } = getIstanbulWeek();
    if (start.toISOString() !== weekKey) {
      throw new WeeklyRewardError("Yeni hafta başladı. Sayfayı yenileyip ödülü tekrar gir.");
    }

    const familyId = member.familyId;
    return tx.weeklyReward.upsert({
      where: { familyId_weekStart: { familyId, weekStart: start } },
      create: { familyId, weekStart: start, title },
      update: { title },
      select: { title: true },
    });
  });
}

export async function getWeeklyRewards(actorId: string, now = new Date(), language: Language = "tr") {
  const member = await getMembership(actorId);
  if (!member) return null;
  const t = createTranslator(language);
  const namesOrder = new Intl.Collator(getLocale(language));
  const unnamed = t("İsimsiz");

  const week = getIstanbulWeek(now);
  const [current, previous] = await Promise.all([
    prisma.weeklyReward.findUnique({
      where: { familyId_weekStart: { familyId: member.familyId, weekStart: week.start } },
      select: { title: true },
    }),
    prisma.weeklyReward.findMany({
      where: { familyId: member.familyId, weekStart: { lt: week.start } },
      orderBy: { weekStart: "desc" },
      take: 6,
      select: { id: true, title: true, weekStart: true },
    }),
  ]);

  const results = await Promise.all(previous.map(async (reward) => {
    const { start, end } = getIstanbulWeek(reward.weekStart);
    const scores = await prisma.pointLedger.groupBy({
      by: ["userId"],
      where: { familyId: member.familyId, createdAt: { gte: start, lt: end } },
      _sum: { points: true },
    });
    const topScore = Math.max(0, ...scores.map((score) => score._sum.points ?? 0));
    const winnerIds = scores
      .filter((score) => topScore > 0 && score._sum.points === topScore)
      .map((score) => score.userId);

    return { id: reward.id, title: reward.title, start, end, topScore, winnerIds };
  }));

  const winnerIds = [...new Set(results.flatMap((result) => result.winnerIds))];
  const winners = winnerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: winnerIds } },
        select: { id: true, name: true, deletedAt: true },
      })
    : [];
  const names = new Map(winners.map((winner) => [winner.id, winner.deletedAt ? t("Silinmiş hesap") : winner.name ?? unnamed]));

  return {
    week,
    current,
    canEdit: isAdminRole(member.role),
    history: results.map(({ winnerIds, ...result }) => ({
      ...result,
      winners: winnerIds
        .map((id) => names.get(id) ?? unnamed)
        .sort(namesOrder.compare),
    })),
  };
}

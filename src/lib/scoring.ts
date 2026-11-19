const DAY_MS = 24 * 60 * 60 * 1000;

export type ScorableRoom = {
  baseScore: number;
  lastCleanedAt: Date | null;
  createdAt: Date;
};

/** Whole elapsed days since the room was last cleaned (or created). */
export function wholeDaysSinceCleaned(room: ScorableRoom, now = new Date()) {
  const reference = room.lastCleanedAt ?? room.createdAt;
  return Math.max(0, Math.floor((now.getTime() - reference.getTime()) / DAY_MS));
}

/** Score rises by one point per full day and is capped at three times base. */
export function calculateRoomScore(room: ScorableRoom, now = new Date()) {
  const daysSinceCleaned = wholeDaysSinceCleaned(room, now);
  const cap = room.baseScore * 3;
  const points = Math.min(room.baseScore + daysSinceCleaned, cap);

  return {
    points,
    daysSinceCleaned,
    cap,
    capped: points === cap,
  };
}

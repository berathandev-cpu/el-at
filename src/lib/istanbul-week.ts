const DAY_MS = 24 * 60 * 60 * 1000;
const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function wallTimeAsUtc(date: Date): number {
  const parts = Object.fromEntries(
    clock.formatToParts(date).map(({ type, value }) => [type, Number(value)]),
  );
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function fromWallMidnight(target: number): Date {
  let instant = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = target - wallTimeAsUtc(new Date(instant));
    if (offset === 0) break;
    instant += offset;
  }
  return new Date(instant);
}

/** Includes local Monday at midnight and excludes the following Monday. */
export function getIstanbulWeek(now = new Date()) {
  const localDay = new Date(wallTimeAsUtc(now));
  localDay.setUTCHours(0, 0, 0, 0);
  const daysSinceMonday = (localDay.getUTCDay() + 6) % 7;
  const monday = localDay.getTime() - daysSinceMonday * DAY_MS;

  return {
    start: fromWallMidnight(monday),
    end: fromWallMidnight(monday + 7 * DAY_MS),
  };
}

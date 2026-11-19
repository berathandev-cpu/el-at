export const WEEKDAYS = [
  { value: 1, label: "Pazartesi" },
  { value: 2, label: "Salı" },
  { value: 3, label: "Çarşamba" },
  { value: 4, label: "Perşembe" },
  { value: 5, label: "Cuma" },
  { value: 6, label: "Cumartesi" },
  { value: 7, label: "Pazar" },
] as const;

const calendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Store an Istanbul calendar date at UTC midnight for the PostgreSQL DATE columns. */
export function istanbulCalendarDay(now = new Date()) {
  const parts = Object.fromEntries(calendar.formatToParts(now).map(({ type, value }) => [type, value]));
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
}

export function asCalendarInput(day: Date) {
  return day.toISOString().slice(0, 10);
}

const dateFormat: Intl.DateTimeFormatOptions = {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
};

export function formatCalendarDay(day: Date, locale = "tr-TR") {
  return new Intl.DateTimeFormat(locale, dateFormat).format(day);
}

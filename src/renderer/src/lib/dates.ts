// Date helpers for the drawing list: which heading a drawing goes under, and short labels.

const DAY = 24 * 60 * 60 * 1000;

export const DATE_GROUPS = [
  "Today",
  "Yesterday",
  "Last week",
  "Older",
] as const;
export type DateGroup = (typeof DATE_GROUPS)[number];

// Made once: building a date formatter is slow, and the lists format a date for every row.
const timeFormat = new Intl.DateTimeFormat([], {
  hour: "numeric",
  minute: "2-digit",
});
const dateFormat = new Intl.DateTimeFormat([], {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/** Calendar days between `iso` and today: 0 today, 1 yesterday… (rounded, so daylight-saving days still count as one). */
function daysAgo(iso: string, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY);
}

/** Which sidebar heading a drawing goes under. */
export function groupFor(iso: string, now = new Date()): DateGroup {
  const days = daysAgo(iso, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Last week";
  return "Older";
}

/** "10:42 AM" */
export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** "Today", "Yesterday", or a short date like "Mon, Nov 2". */
export function formatDay(iso: string, now = new Date()): string {
  const group = groupFor(iso, now);
  return group === "Today" || group === "Yesterday"
    ? group
    : dateFormat.format(new Date(iso));
}

/** "Today, 10:42 AM", like the date chip in the design. */
export function formatWhen(iso: string, now = new Date()): string {
  return `${formatDay(iso, now)}, ${formatTime(iso)}`;
}

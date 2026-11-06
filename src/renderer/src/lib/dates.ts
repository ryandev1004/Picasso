// Date helpers for the drawing list: which heading a drawing goes under, and short labels.

const DAY = 24 * 60 * 60 * 1000;

export type DateGroup = "Today" | "Yesterday" | "Last week" | "Older";
export const DATE_GROUPS: DateGroup[] = [
  "Today",
  "Yesterday",
  "Last week",
  "Older",
];

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
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Today", "Yesterday", or a short date like "Mon, Nov 2". */
export function formatDay(iso: string, now = new Date()): string {
  const days = daysAgo(iso, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Date(iso).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "Today, 10:42 AM", like the date chip in the design. */
export function formatWhen(iso: string, now = new Date()): string {
  return `${formatDay(iso, now)}, ${formatTime(iso)}`;
}

/** "1 version", "3 versions" */
export function versionLabel(count: number): string {
  return count === 1 ? "1 version" : `${count} versions`;
}

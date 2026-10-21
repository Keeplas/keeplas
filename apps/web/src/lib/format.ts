export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Remaining time as "mm:ss" (W04-2 QR expiry), rounded up, never negative. */
export function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

// Each unit and how many of it make the next one.
const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Infinity],
];

/**
 * "2 days ago", "1 week ago" (FR "il y a 2 jours") for the web tables and
 * activity lists. Under a minute reads "now" ("maintenant").
 */
export function formatRelative(
  timestamp: number,
  locale: string,
  now = Date.now(),
): string {
  let value = (timestamp - now) / 1000;
  if (Math.abs(value) < 60) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      0,
      "second",
    );
  }
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(value) < size) return format.format(Math.round(value), unit);
    value /= size;
  }
  return format.format(Math.round(value), "year");
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];
const FRENCH_BYTE_UNITS = ["o", "Ko", "Mo", "Go", "To"];

/** "1.2 MB", "850 KB", "62 MB": one decimal below 10, binary units. */
export function formatBytes(bytes: number, locale = "en"): string {
  const french = locale.startsWith("fr");
  const units = french ? FRENCH_BYTE_UNITS : BYTE_UNITS;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${french ? String(rounded).replace(".", ",") : rounded} ${units[unit]}`;
}

/** "Jan 12, 2026" (FR "12 janv. 2026"). */
export function formatDate(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(timestamp);
}

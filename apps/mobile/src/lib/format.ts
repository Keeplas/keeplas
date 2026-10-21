import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import fr from "i18n-iso-countries/langs/fr.json";

countries.registerLocale(en);
countries.registerLocale(fr);

/** "62 MB", "1.5 GB" in English, "62 Mo", "1,5 Go" in French; decimal units like the plan quotas (100 MB, 10 GB). */
export function formatBytes(bytes: number, locale = "en"): string {
  const french = locale.startsWith("fr");
  const [kb, mb, gb] = french ? ["Ko", "Mo", "Go"] : ["KB", "MB", "GB"];
  const join = (value: number, unit: string) =>
    `${french ? String(value).replace(".", ",") : value}\u00a0${unit}`;
  if (bytes < 1_000_000) return join(Math.round(bytes / 1_000), kb);
  if (bytes < 1_000_000_000) return join(Math.round(bytes / 1_000_000), mb);
  return join(Math.round(bytes / 100_000_000) / 10, gb);
}

/** Local time of day, e.g. "2:32 PM" / "14:32" depending on `locale`. */
export function formatTime(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Local date, e.g. "Oct 11, 2026". */
export function formatDate(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export type RelativeDayKey =
  | "today"
  | "yesterday"
  | "daysAgo"
  | "weekAgo"
  | "weeksAgo"
  | "monthAgo"
  | "monthsAgo"
  | "yearAgo"
  | "yearsAgo";

export function relativeDay(
  timestamp: number,
  now: number = Date.now(),
): { key: RelativeDayKey; n: number } {
  const day = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  };
  const days = Math.max(0, day(now) - day(timestamp));
  if (days === 0) return { key: "today", n: 0 };
  if (days === 1) return { key: "yesterday", n: 1 };
  if (days < 7) return { key: "daysAgo", n: days };
  if (days < 30) {
    const n = Math.floor(days / 7);
    return { key: n === 1 ? "weekAgo" : "weeksAgo", n };
  }
  if (days < 365) {
    const n = Math.floor(days / 30);
    return { key: n === 1 ? "monthAgo" : "monthsAgo", n };
  }
  const n = Math.floor(days / 365);
  return { key: n === 1 ? "yearAgo" : "yearsAgo", n };
}

/** Elapsed time as M:SS (or H:MM:SS for long recordings). */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const remainder = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

/**
 * "FR" → "France" in `locale`; the code itself when unknown. Uses bundled
 * data because Hermes ships without `Intl.DisplayNames`.
 */
export function countryName(code: string, locale: string): string {
  return countries.getName(code, locale) ?? code;
}

export function placeName(
  place: { city?: string; country?: string },
  locale: string,
): string | null {
  const country = place.country ? countryName(place.country, locale) : null;
  if (place.city && country) return `${place.city}, ${country}`;
  return place.city ?? country;
}

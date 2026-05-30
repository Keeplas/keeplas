export const SUPPORTED_LOCALES = ["en", "fr"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export function resolveLocale(value: string | null | undefined): Locale {
  if (!value) return DEFAULT_LOCALE;
  const normalized = value.trim().toLowerCase();
  if (normalized === "fr" || normalized.startsWith("fr-")) return "fr";
  return DEFAULT_LOCALE;
}

export function userLanguageForLocale(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}

export function normalizeUserLanguage(
  value: string | null | undefined,
): string {
  return userLanguageForLocale(resolveLocale(value));
}

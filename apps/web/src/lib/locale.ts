// Client-safe locale helpers, mirroring the landing page's locale module.
// The app stores user preferences as BCP-47 tags (`en-US`, `fr-FR`) while the
// translation/runtime locale is the short route-style code (`en`, `fr`).

export const locales = ["en", "fr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const LANGUAGE_STORAGE_KEY = "keeplas.language";

export const hasLocale = (locale: string): locale is Locale =>
  (locales as readonly string[]).includes(locale);

export function resolveLocale(value: string | null | undefined): Locale {
  if (!value) return defaultLocale;
  const normalized = value.trim().toLowerCase();
  if (normalized === "fr" || normalized.startsWith("fr-")) return "fr";
  return defaultLocale;
}

export function userLanguageForLocale(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}

export function normalizeUserLanguage(
  value: string | null | undefined,
): string {
  return userLanguageForLocale(resolveLocale(value));
}

export function readStoredLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  return resolveLocale(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

export function storeLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    LANGUAGE_STORAGE_KEY,
    userLanguageForLocale(locale),
  );
}

export const localePath = (locale: Locale, path: string) => {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  if (path === "/") return prefix || "/";
  return `${prefix}${path}`;
};

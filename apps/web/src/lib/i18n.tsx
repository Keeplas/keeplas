"use client";

// Preference-based i18n for the authenticated app. Unlike the marketing site
// (which routes locale via the URL), here the locale is a user preference:
// `users.language` in Convex, mirrored to localStorage for pre-auth flows.
// An `I18nProvider` exposes the active locale + a `t()` translator to every
// client component and re-renders the whole tree when the locale changes, so
// switching language in Preferences updates the UI live (no reload).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";
import {
  defaultLocale,
  readStoredLocale,
  resolveLocale,
  storeLocale,
  type Locale,
} from "@/lib/locale";

const dictionaries = { en, fr } as const;
export type Dictionary = (typeof dictionaries)[Locale];

type TranslateParams = Record<string, string | number | undefined>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a dot-path key (e.g. "auth.login.badge"), with {var} interpolation. */
  t: (key: string, params?: TranslateParams) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolvePath(dict: Dictionary, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      dict,
    );
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in params)) return match;
    const value = params[name];
    return value == null ? "" : String(value);
  });
}

function createTranslator(locale: Locale) {
  const active = dictionaries[locale];
  const fallback = dictionaries[defaultLocale];
  return (key: string, params?: TranslateParams): string => {
    const value = resolvePath(active, key) ?? resolvePath(fallback, key);
    if (typeof value !== "string") {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[i18n] missing translation for "${key}" (${locale})`);
      }
      return key;
    }
    return interpolate(value, params);
  };
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    storeLocale(next);
  }, []);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Syncs the active locale from the authenticated user's stored preference.
 * Rendered only inside the Convex provider (it calls `useQuery`). The DB value
 * wins on initial load and whenever it actually changes (e.g. after saving
 * Preferences) — but it is applied only on transitions, so an unsaved manual
 * switch in the auth/onboarding flow is not clobbered.
 */
export function ViewerLocaleSync() {
  const viewer = useQuery(api.users.viewer);
  const language = viewer?.language ?? undefined;
  const ctx = useContext(I18nContext);
  const lastApplied = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!language || !ctx) return;
    if (lastApplied.current === language) return;
    lastApplied.current = language;
    ctx.setLocale(resolveLocale(language));
  }, [language, ctx]);

  return null;
}

function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

/**
 * Returns the full active dictionary. Use when you need structured values that
 * `t()` can't return — e.g. arrays of bullets/FAQ items to map over. Falls back
 * to the default-locale dictionary per key via the spread (active wins).
 */
export function useDictionary(): Dictionary {
  return dictionaries[useLocale()];
}

export function useSetLocale(): (locale: Locale) => void {
  return useI18n().setLocale;
}

/**
 * Returns a `t(key, params?)` translator. Pass a `prefix` namespace to keep
 * call sites terse: `const t = useTranslations("auth.login"); t("badge")`.
 */
export function useTranslations(prefix?: string) {
  const { t } = useI18n();
  return useCallback(
    (key: string, params?: TranslateParams) =>
      t(prefix ? `${prefix}.${key}` : key, params),
    [t, prefix],
  );
}

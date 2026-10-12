import en from "./en.json";
import fr from "./fr.json";

/** UI languages (D12): English by default, French optional. */
export const LANGUAGES = ["en", "fr"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "en";

type Dictionary = { [key: string]: string | Dictionary };
const dictionaries: Record<Language, Dictionary> = { en, fr };

export type TranslateParams = Record<string, string | number>;

function lookup(dict: Dictionary, key: string): string | undefined {
  let node: string | Dictionary | undefined = dict;
  for (const part of key.split(".")) {
    if (typeof node !== "object") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Resolve `key` in `language`, falling back to English for missing French
 * keys (D12), then to the key itself so a typo is visible, never blank.
 * `{name}` placeholders are replaced from `params`.
 */
export function translate(
  language: Language,
  key: string,
  params?: TranslateParams,
): string {
  const template =
    lookup(dictionaries[language], key) ??
    lookup(dictionaries[DEFAULT_LANGUAGE], key) ??
    key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Map any stored tag ("fr-FR", "fr", "en-US", null) to a UI language. */
export function resolveLanguage(value: string | null | undefined): Language {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "fr" || normalized.startsWith("fr-") ? "fr" : "en";
}

/** BCP-47 tag stored on `users.language` (mirrors convex/lib/locale.ts). */
export function accountLanguageTag(language: Language): string {
  return language === "fr" ? "fr-FR" : "en-US";
}

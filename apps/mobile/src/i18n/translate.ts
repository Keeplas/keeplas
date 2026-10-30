import en from "./en.json";
import fr from "./fr.json";

/** UI languages (D12): the phone language when supported, else English. */
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
 * CLDR plural category "one" for whole counts: English 1, French 0 and 1.
 * Hand-written because Hermes ships no Intl.PluralRules.
 */
const isPluralOne: Record<Language, (count: number) => boolean> = {
  en: (count) => count === 1,
  fr: (count) => count === 0 || count === 1,
};

/** `key_one` when `count` is singular in `language` and it exists, else `key`. */
function resolve(
  language: Language,
  key: string,
  count: string | number | undefined,
): string | undefined {
  const dict = dictionaries[language];
  const one = typeof count === "number" && isPluralOne[language](count);
  return (one ? lookup(dict, `${key}_one`) : undefined) ?? lookup(dict, key);
}

/**
 * Resolve `key` in `language`, falling back to English for missing French
 * keys (D12), then to the key itself so a typo is visible, never blank.
 * A numeric `params.count` picks the `key_one` form when the language
 * reads it as singular; the plain `key` is the plural form.
 * `{name}` placeholders are replaced from `params`.
 */
export function translate(
  language: Language,
  key: string,
  params?: TranslateParams,
): string {
  const template =
    resolve(language, key, params?.count) ??
    resolve(DEFAULT_LANGUAGE, key, params?.count) ??
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

/**
 * First UI language in the phone's preference order (`getLocales()` tags),
 * English when none is supported (D12).
 */
export function deviceLanguage(tags: readonly string[]): Language {
  for (const tag of tags) {
    const code = tag.trim().toLowerCase().split("-")[0];
    if ((LANGUAGES as readonly string[]).includes(code))
      return code as Language;
  }
  return DEFAULT_LANGUAGE;
}

/** BCP-47 tag stored on `users.language` (mirrors convex/lib/locale.ts). */
export function accountLanguageTag(language: Language): string {
  return language === "fr" ? "fr-FR" : "en-US";
}

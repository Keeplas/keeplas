import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getLocales } from "expo-localization";

import {
  deviceLanguage,
  resolveLanguage,
  translate,
  type Language,
  type TranslateParams,
} from "@/i18n/translate";
import { readPreference, writePreference } from "@/lib/preferences";

interface I18nValue {
  language: Language;
  /** Device-side change; `useChangeLanguage` also saves it on the account. */
  setLanguage: (language: Language) => void;
  t: (key: string, params?: TranslateParams) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

/** Follows the phone language until a choice is saved on the device (D12). */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() =>
    deviceLanguage(getLocales().map((locale) => locale.languageTag)),
  );

  useEffect(() => {
    readPreference("language").then((stored) => {
      if (stored) setLanguageState(resolveLanguage(stored));
    });
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    void writePreference("language", next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      language,
      setLanguage,
      t: (key, params) => translate(language, key, params),
    }),
    [language, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

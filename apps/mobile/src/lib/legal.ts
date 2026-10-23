import { Linking } from "react-native";

import type { Language } from "@/i18n/translate";

/** Open a public legal page on keeplas.com (French pages live under /fr). */
export function openLegalPage(
  page: "privacy" | "terms",
  language: Language,
): Promise<void> {
  const prefix = language === "fr" ? "/fr" : "";
  return Linking.openURL(`https://keeplas.com${prefix}/${page}`);
}

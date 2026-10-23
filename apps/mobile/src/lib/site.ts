import { Linking } from "react-native";

import type { Language } from "@/i18n/translate";

/** Open a public page on keeplas.com (French pages live under /fr). */
export function openSitePage(
  page: "privacy" | "terms" | "lost-phone",
  language: Language,
): Promise<void> {
  const prefix = language === "fr" ? "/fr" : "";
  return Linking.openURL(`https://keeplas.com${prefix}/${page}`);
}

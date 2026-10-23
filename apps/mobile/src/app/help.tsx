import { useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { FaqSection, type FaqEntry } from "@/features/faq";
import { openSitePage } from "@/lib/site";
import { useI18n } from "@/providers/i18n-provider";

const SECTIONS = {
  change: ["newPhone", "platform"],
  lost: ["lostPhone", "lostNumber", "lostAuthenticator", "nothingLeft"],
  understand: ["backup", "kit", "wait", "travelMode", "notMe", "zeroAccess"],
} as const;

/**
 * Help: answers about recovery, a lost phone and a new phone, then the full
 * guide on keeplas.com and the support form. Reachable signed out too.
 */
export default function Help() {
  const router = useRouter();
  const { t, language } = useI18n();
  const entries = (keys: readonly string[]): FaqEntry[] =>
    keys.map((key) => ({
      question: t(`help.q.${key}.question`),
      answer: t(`help.q.${key}.answer`),
    }));

  return (
    <Screen
      header={
        <AppHeader onBack={router.canGoBack() ? router.back : undefined} />
      }
      gap={12}
    >
      <Text variant="h1">{t("help.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("help.body")}
      </Text>
      {(Object.keys(SECTIONS) as (keyof typeof SECTIONS)[]).map((section) => (
        <FaqSection
          key={section}
          title={t(`help.sections.${section}`)}
          items={entries(SECTIONS[section])}
        />
      ))}
      <ListRow
        icon="globe"
        title={t("help.guide")}
        description={t("help.guideBody")}
        onPress={() => openSitePage("lost-phone", language)}
      />
      <ListRow
        icon="mail"
        title={t("support.title")}
        description={t("help.supportBody")}
        onPress={() => router.push("/support")}
      />
    </Screen>
  );
}

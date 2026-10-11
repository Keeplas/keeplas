import { Alert } from "react-native";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { RequiredSteps } from "@/components/stepper";
import { Screen } from "@/components/screen";
import { Callout, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";

const SLOTS = [1, 2, 3];

/**
 * M01-5 Add trust contacts (optional). Inviting is part of People (M06,
 * next part); for now the slots explain that and "Skip" moves on.
 */
export default function ContactsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const later = () => Alert.alert(t("contacts.title"), t("contacts.later"));

  return (
    <Screen header={<AppHeader />} gap={16}>
      <RequiredSteps completed={3} />
      <Text variant="h1">{t("contacts.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("contacts.body")}
      </Text>
      {SLOTS.map((n) => (
        <ListRow
          key={n}
          icon="user-plus"
          title={t("contacts.addContact")}
          description={t("contacts.slot", { n })}
          onPress={later}
        />
      ))}
      <Button label={t("contacts.invite")} chevron onPress={later} />
      <Button
        variant="secondary"
        label={t("contacts.skip")}
        onPress={() => router.push("/done")}
      />
      <Callout
        tone="warning"
        icon="alert-triangle"
        text={t("contacts.warning")}
      />
    </Screen>
  );
}

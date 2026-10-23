import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { RequiredSteps } from "@/components/stepper";
import { Screen } from "@/components/screen";
import { Callout, ListRow, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";

/**
 * M01-5 Add trust contacts (optional). Lists the invited contacts and opens
 * the invite form; "Skip" (or "Continue" once someone is invited) moves on.
 */
export default function ContactsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const contacts = useQuery(api.trusted_contacts.getContactSummaries) ?? [];

  return (
    <Screen header={<AppHeader />} gap={16}>
      <RequiredSteps completed={3} />
      <Text variant="h1">{t("contacts.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("contacts.body")}
      </Text>
      {contacts.map((contact) => (
        <ListRow
          key={contact._id}
          icon="user"
          title={contact.name}
          description={contact.email ?? contact.phoneNumber ?? ""}
          trailing={
            <StatusChip
              tone={
                contact.invitationStatus === "accepted" ? "success" : "warning"
              }
              label={t(`people.status.${contact.invitationStatus}`)}
            />
          }
        />
      ))}
      <Button
        label={t("contacts.invite")}
        chevron
        onPress={() => router.push("/add-contact")}
      />
      <Button
        variant="secondary"
        label={t(contacts.length ? "common.continue" : "contacts.skip")}
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

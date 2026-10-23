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

const SLOTS = [1, 2, 3];

/**
 * M01-5 Add trust contacts (optional). Each slot shows an invited contact or
 * opens the invite form; "Skip" (or "Continue" once someone is invited)
 * moves on.
 */
export default function ContactsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const contacts = useQuery(api.trusted_contacts.getContactSummaries);
  const trust = (contacts ?? []).filter((c) => c.contactType === "trust");
  const add = () => router.push("/add-contact");

  return (
    <Screen header={<AppHeader />} gap={16}>
      <RequiredSteps completed={3} />
      <Text variant="h1">{t("contacts.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("contacts.body")}
      </Text>
      {SLOTS.map((n, index) => {
        const contact = trust[index];
        return contact ? (
          <ListRow
            key={n}
            icon="user"
            title={contact.name}
            description={contact.email ?? contact.phoneNumber ?? ""}
            trailing={
              <StatusChip
                tone={
                  contact.invitationStatus === "accepted"
                    ? "success"
                    : "warning"
                }
                label={t(`people.status.${contact.invitationStatus}`)}
              />
            }
          />
        ) : (
          <ListRow
            key={n}
            icon="user-plus"
            title={t("contacts.addContact")}
            description={t("contacts.slot", { n })}
            onPress={add}
          />
        );
      })}
      {trust.length < SLOTS.length ? (
        <Button label={t("contacts.invite")} chevron onPress={add} />
      ) : null}
      <Button
        variant="secondary"
        label={t(trust.length ? "common.continue" : "contacts.skip")}
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

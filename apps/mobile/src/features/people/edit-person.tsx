import { useState, type ReactNode } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@keeplas/backend/_generated/api";

import { Button } from "@/components/button";
import { LanguageDropdown } from "@/components/language";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { toPhoneField } from "@/lib/phone";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { deviceCountry } from "@/lib/use-phone-field";
import { useI18n } from "@/providers/i18n-provider";

import { inviteErrorKey } from "./invite-error";
import { PersonFields, usePersonForm } from "./person-form";

type Contact = FunctionReturnType<
  typeof api.trusted_contacts.getContactSummaries
>[number];

/** Edit trusted person: fix a name, email or phone number. */
export function EditPerson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const contacts = useQuery(api.trusted_contacts.getContactSummaries);
  const contact = contacts?.find((c) => c._id === id);
  const header = (
    <NavBar
      title={t("people.editTitle")}
      onBack={router.back}
      right={<LanguageDropdown />}
    />
  );

  if (!contact) {
    return (
      <Screen header={header} center>
        <Text variant="body" color="text.muted">
          {contacts ? t("people.notFound") : ""}
        </Text>
      </Screen>
    );
  }
  return <EditPersonForm contact={contact} header={header} />;
}

function EditPersonForm({
  contact,
  header,
}: {
  contact: Contact;
  header: ReactNode;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const update = useAuditedMutation(api.trusted_contacts.updateContact);
  const form = usePersonForm(`edit-person:${contact._id}`, () => {
    const phone = contact.phoneNumber
      ? toPhoneField(contact.phoneNumber, deviceCountry())
      : undefined;
    return {
      name: contact.name,
      email: contact.email ?? "",
      phoneCountry: phone?.country,
      phoneInput: phone?.number ?? "",
    };
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const details = form.validate();
    if (!details) return;
    setError(null);
    setBusy(true);
    try {
      await update({
        contactId: contact._id,
        ...details,
      });
      form.clearDraft();
      toast({ variant: "success", title: t("people.saved") });
      router.back();
    } catch (failure) {
      setError(t(inviteErrorKey(failure, "people.saveFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={header}
      footer={
        <Button
          label={t("people.save")}
          onPress={save}
          loading={busy}
          disabled={!form.filled}
        />
      }
    >
      <Text variant="h1">{t("people.editTitle")}</Text>
      {contact.invitationStatus === "pending" ? (
        <Callout icon="info" text={t("people.editReinvite")} />
      ) : null}
      <PersonFields form={form} onSubmit={save} />
      {error ? (
        <Text variant="body-sm" color="status.revoked">
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}

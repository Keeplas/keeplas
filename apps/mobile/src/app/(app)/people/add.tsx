import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { TextField } from "@/components/text-field";
import { Text } from "@/components/text";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";

/** M06-2: invite one trusted person by email or verified phone channel. */
export default function AddPerson() {
  const router = useRouter();
  const { t } = useI18n();
  const invite = useAuditedMutation(api.trusted_contacts.inviteContact);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await invite({
        name: name.trim(),
        email: email.trim() || undefined,
        phoneNumber: phone.trim() || undefined,
        role: "friend",
        contactType: "trust",
      });
      router.back();
    } catch (error) {
      Alert.alert(
        t("common.genericError"),
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={<NavBar title={t("people.addTitle")} onBack={router.back} />}
      footer={
        <Button
          label={t("people.sendInvite")}
          onPress={submit}
          loading={busy}
          disabled={!name.trim() || (!email.trim() && !phone.trim())}
        />
      }
    >
      <Text variant="h1">{t("people.addTitle")}</Text>
      <Text color="text.muted">{t("people.addBody")}</Text>
      <TextField
        label={t("people.name")}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <TextField
        label={t("people.email")}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextField
        label={t("people.phone")}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
    </Screen>
  );
}

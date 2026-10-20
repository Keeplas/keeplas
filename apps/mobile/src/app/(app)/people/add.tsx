import { useState } from "react";
import { useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";
import { isValidEmail, normalizeEmail } from "@keeplas/backend/lib/email";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { PhoneInput } from "@/components/phone-input";
import { Screen } from "@/components/screen";
import { TextField } from "@/components/text-field";
import { Text } from "@/components/text";
import { errorText } from "@/lib/errors";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { usePhoneField } from "@/lib/use-phone-field";
import { useI18n } from "@/providers/i18n-provider";

/** M06-2: invite one trusted person; name, email and phone are all required. */
export default function AddPerson() {
  const router = useRouter();
  const { t } = useI18n();
  const invite = useAuditedMutation(api.trusted_contacts.inviteContact);
  const phone = usePhoneField();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    const emailOk = isValidEmail(email);
    setEmailError(!emailOk);
    const phoneNumber = phone.validate();
    if (!emailOk || !phoneNumber) return;
    setBusy(true);
    try {
      await invite({
        name: name.trim(),
        email: normalizeEmail(email),
        phoneNumber,
        role: "friend",
        contactType: "trust",
      });
      router.back();
    } catch (failure) {
      const text = errorText(failure);
      setError(
        text.includes("Maximum")
          ? t("people.maxReached")
          : text.includes("already")
            ? t("people.alreadyInvited")
            : t("people.inviteFailed"),
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
          disabled={!name.trim() || !email.trim() || !phone.inputProps.value}
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
        textContentType="name"
      />
      <TextField
        label={t("people.email")}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setEmailError(false);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
      />
      {emailError ? (
        <Text variant="body-sm" color="status.revoked">
          {t("people.emailInvalid")}
        </Text>
      ) : null}
      <Text variant="label">{t("people.phone")}</Text>
      <PhoneInput {...phone.inputProps} onSubmit={submit} />
      {phone.inputProps.invalid ? (
        <Text variant="body-sm" color="status.revoked">
          {t("phone.invalid")}
        </Text>
      ) : null}
      {error ? (
        <Text variant="body-sm" color="status.revoked">
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}

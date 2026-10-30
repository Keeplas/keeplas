import { useState } from "react";
import { useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { PhoneInput } from "@/components/phone-input";
import { Screen } from "@/components/screen";
import { Callout, Note } from "@/components/surfaces";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { errorText } from "@/lib/errors";
import { saveClaim } from "@/lib/lost-number";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { usePhoneField } from "@/lib/use-phone-field";
import { useI18n } from "@/providers/i18n-provider";

const ERRORS: Record<string, string> = {
  NO_ACCOUNT: "phone.noAccount",
  SAME_NUMBER: "lostNumber.sameNumber",
  REQUEST_IN_PROGRESS: "lostNumber.inProgress",
  NUMBER_TAKEN: "lostNumber.newTaken",
  INVALID_EMAIL: "lostNumber.invalidEmail",
  "Too many": "codeErrors.tooManyBody",
  // store_review.refuseOnReviewAccount
  "Review accounts can't change": "account.errors.reviewAccount",
};

/**
 * No 24 words: ask support to move the account to a new number. What is
 * declared here is compared with the account in the admin console; the
 * request waits 72 h while the owner's devices, email and old number are
 * alerted.
 */
export default function LostNumberRequest() {
  const router = useRouter();
  const { t } = useI18n();
  const oldPhone = usePhoneField();
  const newPhone = usePhoneField();
  const submit = useAuditedMutation(api.number_change.submit);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const from = oldPhone.validate();
    const to = newPhone.validate();
    if (!from || !to) return setError(t("phone.invalid"));
    if (!name.trim()) return setError(t("lostNumber.nameRequired"));
    setBusy(true);
    setError(null);
    const showError = (text: string) => {
      const key = Object.keys(ERRORS).find((k) => text.includes(k));
      setError(t(key ? ERRORS[key] : "common.genericError"));
    };
    try {
      const result = await submit({
        oldPhone: from,
        newPhone: to,
        name,
        email: email.trim() || undefined,
        message: message.trim() || undefined,
      });
      if (!result.ok) return showError(result.error);
      saveClaim({ requestId: result.requestId, claimToken: result.claimToken });
      router.replace("/lost-number/status");
    } catch (err) {
      showError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={
        <AppHeader onBack={router.canGoBack() ? router.back : undefined} />
      }
    >
      <Text variant="h1">{t("lostNumber.withSupport")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("lostNumber.requestBody")}
      </Text>
      <Text variant="label">{t("lostNumber.oldNumber")}</Text>
      <PhoneInput {...oldPhone.inputProps} />
      <Text variant="label">{t("lostNumber.newNumber")}</Text>
      <PhoneInput {...newPhone.inputProps} />
      <TextField
        label={t("lostNumber.name")}
        value={name}
        onChangeText={setName}
        autoComplete="name"
      />
      <TextField
        label={t("lostNumber.email")}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <TextField
        label={t("lostNumber.message")}
        value={message}
        onChangeText={setMessage}
        placeholder={t("lostNumber.messagePlaceholder")}
        multiline
      />
      {error ? (
        <Callout tone="danger" icon="alert-circle" text={error} />
      ) : null}
      <Button
        label={t("lostNumber.send")}
        chevron
        loading={busy}
        onPress={send}
      />
      <Note icon="clock" text={t("lostNumber.requestNote")} />
    </Screen>
  );
}

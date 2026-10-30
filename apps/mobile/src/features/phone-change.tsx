import { useState, type ReactNode } from "react";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { ErrorText } from "@/components/error-text";
import { PhoneInput } from "@/components/phone-input";
import { Screen } from "@/components/screen";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { accountErrorKey } from "@/features/account/errors";
import { CodeVerification } from "@/features/code-verification";
import { errorText } from "@/lib/errors";
import { formatPhone } from "@/lib/phone";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { usePhoneField } from "@/lib/use-phone-field";
import { useI18n } from "@/providers/i18n-provider";

/**
 * Set the account's sign-in number (phone_verification): the number, then
 * its WhatsApp code on `verifyPath` (which renders {@link PhoneCodeStep}).
 * Shared by the email → phone migration (M09-7) and the new number after a
 * lost one.
 */
export function PhoneNumberStep({
  title,
  body,
  verifyPath,
  beforeRequest,
  footer,
}: {
  title: string;
  body?: string;
  verifyPath: Href & string;
  beforeRequest?: () => Promise<void>;
  footer?: ReactNode;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const phone = usePhoneField();
  const requestVerification = useMutation(
    api.phone_verification.requestVerification,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const phoneNumber = phone.validate();
    if (!phoneNumber) return setError(t("phone.invalid"));
    setBusy(true);
    setError(null);
    try {
      await beforeRequest?.();
      await requestVerification({ phoneNumber });
      router.push({ pathname: verifyPath, params: { phone: phoneNumber } });
    } catch (err) {
      const text = errorText(err);
      setError(
        text.includes("Too many")
          ? t("codeErrors.tooManyBody")
          : text.includes("already linked")
            ? t("lostNumber.newTaken")
            : t(accountErrorKey(err)),
      );
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
      <Text variant="h1">{title}</Text>
      {body ? (
        <Text variant="body-lg" color="text.muted">
          {body}
        </Text>
      ) : null}
      <Text variant="label">{t("phone.label")}</Text>
      <PhoneInput {...phone.inputProps} onSubmit={submit} />
      <ErrorText>{error}</ErrorText>
      <Button
        label={t("migration.sendCode")}
        chevron
        loading={busy}
        onPress={submit}
      />
      <Callout icon="whatsapp" text={t("verify.note")} />
      {footer}
    </Screen>
  );
}

/** The WhatsApp code that verifies the number chosen in {@link PhoneNumberStep}. */
export function PhoneCodeStep({ onVerified }: { onVerified?: () => void }) {
  const { t } = useI18n();
  const { phone = "" } = useLocalSearchParams<{ phone: string }>();
  const verifyCode = useAuditedMutation(api.phone_verification.verifyCode);
  const requestVerification = useMutation(
    api.phone_verification.requestVerification,
  );

  return (
    <CodeVerification
      title={t("verify.title")}
      body={t("verify.body", { phone: formatPhone(phone) })}
      destination={formatPhone(phone)}
      confirmLabel={t("verify.confirm")}
      note={t("verify.note")}
      onSubmit={async (code) => {
        const result = await verifyCode({ code });
        if (!result.verified) throw new Error(result.error);
        onVerified?.();
      }}
      onResend={async () => {
        await requestVerification({ phoneNumber: phone });
      }}
    />
  );
}

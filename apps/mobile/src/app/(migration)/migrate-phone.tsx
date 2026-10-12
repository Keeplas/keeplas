import { useState } from "react";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { PhoneInput } from "@/components/phone-input";
import { Screen } from "@/components/screen";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { errorText } from "@/lib/errors";
import { usePhoneField } from "@/lib/use-phone-field";
import { useI18n } from "@/providers/i18n-provider";

/** M09-7 step 1: the phone number that will sign this account in. */
export default function MigratePhone() {
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
      await requestVerification({ phoneNumber });
      router.push({
        pathname: "/migrate-verify",
        params: { phone: phoneNumber },
      });
    } catch (err) {
      setError(
        errorText(err).includes("Too many")
          ? t("codeErrors.tooManyBody")
          : t("common.genericError"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<AppHeader onBack={router.back} />}>
      <Text variant="h1">{t("migration.phoneStep")}</Text>
      <Text variant="label">{t("phone.label")}</Text>
      <PhoneInput {...phone.inputProps} onSubmit={submit} />
      {error ? (
        <Text variant="body-sm" color="status.revoked">
          {error}
        </Text>
      ) : null}
      <Button
        label={t("migration.sendCode")}
        chevron
        loading={busy}
        onPress={submit}
      />
      <Callout icon="whatsapp" text={t("verify.note")} />
    </Screen>
  );
}

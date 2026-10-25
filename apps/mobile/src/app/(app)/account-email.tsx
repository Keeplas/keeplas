import { useState } from "react";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { isValidEmail, normalizeEmail } from "@keeplas/backend/lib/email";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { accountErrorKey } from "@/features/account/errors";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";

export default function AccountEmail() {
  const router = useRouter();
  const { t } = useI18n();
  const viewer = useViewer();
  const requestVerification = useMutation(
    api.email_verification.requestVerification,
  );
  const changing = Boolean(viewer.emailVerificationTime);
  const [email, setEmail] = useState(changing ? "" : (viewer.email ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!isValidEmail(email)) return setError(t("account.errors.invalidEmail"));
    const next = normalizeEmail(email);
    setBusy(true);
    setError(null);
    try {
      await requestVerification({ email: next });
      router.push({
        pathname: "/account-email-verify",
        params: { email: next },
      });
    } catch (err) {
      setError(t(accountErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<NavBar title={t("account.title")} onBack={router.back} />}>
      <Text variant="h1">
        {t(
          changing
            ? "account.emailStep.titleChange"
            : "account.emailStep.titleAdd",
        )}
      </Text>
      <Text variant="body-lg" color="text.muted">
        {t(
          changing
            ? "account.emailStep.bodyChange"
            : "account.emailStep.bodyAdd",
        )}
      </Text>
      <TextField
        label={t("account.emailStep.label")}
        value={email}
        onChangeText={setEmail}
        placeholder={t("account.emailStep.placeholder")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
        autoFocus
      />
      {error ? (
        <Text variant="body-sm" color="status.revoked">
          {error}
        </Text>
      ) : null}
      <Button
        label={t("account.emailStep.cta")}
        chevron
        loading={busy}
        onPress={submit}
      />
    </Screen>
  );
}

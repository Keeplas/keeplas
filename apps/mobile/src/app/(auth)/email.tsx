import { useState } from "react";
import { useRouter } from "expo-router";
import { useAuthActions } from "@convex-dev/auth/react";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useI18n } from "@/providers/i18n-provider";

/**
 * Existing email + password accounts (D5) sign in once in the app, then
 * clear the login-OTP step and move to phone sign-in (M09-7).
 */
export default function EmailSignIn() {
  const router = useRouter();
  const { t } = useI18n();
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit() {
    setBusy(true);
    setError(false);
    try {
      await signIn("password", {
        email: email.trim().toLowerCase(),
        password,
        flow: "signIn",
      });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<AppHeader onBack={router.back} />}>
      <Text variant="h1">{t("email.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("email.body")}
      </Text>
      <TextField
        label={t("email.email")}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
      />
      <TextField
        label={t("email.password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
      />
      {error ? (
        <Text variant="body-sm" color="status.revoked">
          {t("email.wrong")}
        </Text>
      ) : null}
      <Button
        label={t("email.cta")}
        chevron
        loading={busy}
        disabled={!email || !password}
        onPress={submit}
      />
    </Screen>
  );
}

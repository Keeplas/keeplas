import { useState } from "react";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { OtpInput, OTP_LENGTH } from "@/components/otp-input";
import { Screen } from "@/components/screen";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { classifyCodeError } from "@/lib/errors";
import { useI18n } from "@/providers/i18n-provider";
import { useSession } from "@/providers/session-provider";

/**
 * TOTP step for accounts with an authenticator app (the web's /login/totp):
 * the session must clear it before `requireFullAuth` functions accept it.
 * Once cleared, the gate query flips and the root layout moves on.
 */
export default function LoginTotp() {
  const router = useRouter();
  const { t } = useI18n();
  const { signOut } = useSession();
  const submitCode = useMutation(api.totp.submitTotpForSession);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(value = code) {
    if (value.length !== OTP_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitCode({ code: value });
      if (!result.success) throw new Error(result.error);
    } catch (e) {
      setError(
        classifyCodeError(e) === "tooMany"
          ? t("totp.tooMany")
          : t("totp.wrong"),
      );
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen decor="landscape" header={<AppHeader />}>
      <Text variant="h1">{t("totp.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("totp.body")}
      </Text>
      <OtpInput
        value={code}
        onChange={setCode}
        onComplete={submit}
        invalid={error !== null}
        label={t("totp.title")}
      />
      {error ? (
        <Callout tone="danger" icon="alert-circle" text={error} />
      ) : null}
      <Button
        label={t("totp.cta")}
        chevron
        loading={busy}
        onPress={() => submit()}
      />
      <Button
        variant="text"
        label={t("totp.lost")}
        onPress={() => router.push("/totp-recovery")}
      />
      <Button variant="text" label={t("settings.signOut")} onPress={signOut} />
    </Screen>
  );
}

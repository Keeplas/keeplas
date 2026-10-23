import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthActions } from "@convex-dev/auth/react";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { CodeVerification } from "@/features/code-verification";
import { accountLanguageTag } from "@/i18n/translate";
import { attestationReference } from "@/lib/attestation";
import { passkeyFailure } from "@/lib/errors";
import { formatPhone } from "@/lib/phone";
import { usePasskeySignIn } from "@/lib/use-passkey-sign-in";
import {
  AttestationFailed,
  useRequestPhoneCode,
  type PhoneIntent,
} from "@/lib/use-request-phone-code";
import { useI18n } from "@/providers/i18n-provider";

/** M01-2 Verify your number → `signIn("phone-otp")`; the stage gate moves on. */
export default function VerifyScreen() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { signIn } = useAuthActions();
  const requestCode = useRequestPhoneCode();
  const { phone = "", intent = "signup" } = useLocalSearchParams<{
    phone: string;
    intent: PhoneIntent;
  }>();

  return (
    <CodeVerification
      title={t("verify.title")}
      body={t("verify.body", { phone: formatPhone(phone) })}
      destination={formatPhone(phone)}
      confirmLabel={t("verify.confirm")}
      note={t("verify.note")}
      onSubmit={async (code) => {
        await signIn("phone-otp", {
          phoneNumber: phone,
          code,
          flow: intent === "signup" ? "signUp" : "signIn",
          language: accountLanguageTag(language),
        });
      }}
      onResend={async () => {
        try {
          await requestCode(phone, intent);
        } catch (error) {
          if (!(error instanceof AttestationFailed)) throw error;
          router.replace({
            pathname: "/device-check",
            params: { ref: attestationReference() },
          });
        }
      }}
      footer={intent === "signin" ? <PasskeySignIn /> : undefined}
    />
  );
}

/** Sign-in only: a synced passkey instead of the WhatsApp code. */
function PasskeySignIn() {
  const { t } = useI18n();
  const passkeySignIn = usePasskeySignIn();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // The stage gate moves on once the session opens.
  async function signIn() {
    setBusy(true);
    setFailed(false);
    try {
      await passkeySignIn();
    } catch (error) {
      setFailed(passkeyFailure(error) !== null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        label={t("verify.passkey")}
        loading={busy}
        onPress={signIn}
      />
      {failed ? (
        <Text variant="body-sm" color="status.revoked" align="center">
          {t("verify.passkeyFailed")}
        </Text>
      ) : null}
    </>
  );
}

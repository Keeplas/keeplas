import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthActions } from "@convex-dev/auth/react";

import { CodeVerification } from "@/features/code-verification";
import { accountLanguageTag } from "@/i18n/translate";
import { attestationReference } from "@/lib/attestation";
import { formatPhone } from "@/lib/phone";
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
    />
  );
}

import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { CodeVerification } from "@/features/code-verification";
import { OtherOptions } from "@/features/other-options";
import { useI18n } from "@/providers/i18n-provider";

/**
 * Login-OTP step for password accounts (the web's /login/otp): the session
 * must clear it before `requireFullAuth` functions accept it.
 */
export default function LoginOtp() {
  const { t } = useI18n();
  const gate = useQuery(api.login_otp.getMyLoginOtpGate);
  const requestCode = useMutation(api.login_otp.requestLoginOtp);
  const submitCode = useMutation(api.login_otp.submitLoginOtpForSession);
  const channel = gate?.channelMasked ?? "";

  useEffect(() => {
    requestCode().catch(() => undefined); // The resend action surfaces errors.
  }, [requestCode]);

  return (
    <CodeVerification
      title={t("email.otpTitle")}
      body={t("email.otpBody", { channel })}
      destination={channel}
      confirmLabel={t("email.otpCta")}
      onSubmit={async (code) => {
        const result = await submitCode({ code });
        if (!result.success) throw new Error(result.error);
      }}
      onResend={async () => {
        await requestCode();
      }}
      footer={<OtherOptions />}
    />
  );
}

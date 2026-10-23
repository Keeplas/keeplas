import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { CodeVerification } from "@/features/code-verification";
import { useI18n } from "@/providers/i18n-provider";

/** A WhatsApp code to the account's number, proving it in this session. */
export default function PhoneProof() {
  const router = useRouter();
  const { t } = useI18n();
  const proofs = useQuery(api.session_proofs.getMine);
  const requestCode = useMutation(api.session_proofs.requestPhoneCode);
  const verifyCode = useMutation(api.session_proofs.verifyPhoneCode);
  const phone = proofs?.phoneMasked ?? "";

  useEffect(() => {
    requestCode().catch(() => undefined); // The resend action surfaces errors.
  }, [requestCode]);

  return (
    <CodeVerification
      title={t("phoneProof.title")}
      body={t("phoneProof.body", { phone })}
      destination={phone}
      confirmLabel={t("phoneProof.cta")}
      note={t("verify.note")}
      onSubmit={async (code) => {
        const result = await verifyCode({ code });
        if (!result.success) throw new Error(result.error);
        router.back();
      }}
      onResend={async () => {
        await requestCode();
      }}
    />
  );
}

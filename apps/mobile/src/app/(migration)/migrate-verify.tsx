import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { CodeVerification } from "@/features/code-verification";
import { formatPhone } from "@/lib/phone";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";

/** M09-7 step 2: the WhatsApp code that verifies the new sign-in number. */
export default function MigrateVerify() {
  const router = useRouter();
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
        await verifyCode({ code });
        router.replace("/move-to-phone");
      }}
      onResend={async () => {
        await requestVerification({ phoneNumber: phone });
      }}
    />
  );
}

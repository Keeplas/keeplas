import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { accountErrorKey } from "@/features/account/errors";
import { CodeVerification } from "@/features/code-verification";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";

const NOT_A_CODE_ERROR = new Set([
  "account.errors.emailTaken",
  "account.errors.sameEmail",
]);

export default function AccountEmailVerify() {
  const router = useRouter();
  const { t } = useI18n();
  const { email = "" } = useLocalSearchParams<{ email: string }>();
  const verifyCodeAndLink = useAuditedMutation(
    api.email_verification.verifyCodeAndLink,
  );
  const requestVerification = useMutation(
    api.email_verification.requestVerification,
  );

  return (
    <CodeVerification
      title={t("account.emailVerify.title")}
      body={t("account.emailVerify.body", { email })}
      destination={email}
      confirmLabel={t("account.emailVerify.confirm")}
      onSubmit={async (code) => {
        try {
          const result = await verifyCodeAndLink({ code });
          if (!result.verified) throw new Error(result.error);
        } catch (error) {
          const key = accountErrorKey(error);
          if (!NOT_A_CODE_ERROR.has(key)) throw error;
          toast({ variant: "error", title: t(key) });
          router.back();
          return;
        }
        toast({ variant: "success", title: t("account.emailVerify.done") });
        router.dismissTo("/account");
      }}
      onResend={async () => {
        await requestVerification({ email });
      }}
    />
  );
}

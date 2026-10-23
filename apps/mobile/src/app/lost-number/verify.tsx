import { useState } from "react";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { CodeVerification } from "@/features/code-verification";
import { clearClaim, readClaim } from "@/lib/lost-number";
import { useI18n } from "@/providers/i18n-provider";

/**
 * The code sent to the new number completes the request: the account moves
 * to it, other sessions end, and this phone signs in (`number-change`).
 */
export default function LostNumberVerify() {
  const router = useRouter();
  const { t } = useI18n();
  const { signIn } = useAuthActions();
  const [claim] = useState(readClaim);
  const args = claim
    ? {
        requestId: claim.requestId as Id<"number_change_requests">,
        claimToken: claim.claimToken,
      }
    : "skip";
  const request = useQuery(api.number_change.status, args);
  const requestCode = useMutation(api.number_change.requestCompletionCode);
  const phone = request?.newPhoneMasked ?? "";

  return (
    <CodeVerification
      title={t("verify.title")}
      body={t("verify.body", { phone })}
      destination={phone}
      confirmLabel={t("verify.confirm")}
      note={t("verify.note")}
      onSubmit={async (code) => {
        if (args === "skip") return router.replace("/lost-number");
        await signIn("number-change", { ...args, code });
        await clearClaim();
      }}
      onResend={async () => {
        if (args !== "skip") await requestCode(args);
      }}
    />
  );
}

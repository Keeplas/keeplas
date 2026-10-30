import { useCallback } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { accountLanguageTag } from "@/i18n/translate";
import { useI18n } from "@/providers/i18n-provider";
import { attestDevice } from "./attestation";
import { auditContext, useAuditedMutation } from "./use-audited-mutation";

export type PhoneIntent = "signup" | "signin";

/** Thrown when the device could not attest: show M09-9. */
export class AttestationFailed extends Error {}

/**
 * Send the WhatsApp sign-up / sign-in code. A sign-up code is only issued
 * after this phone attested itself (createChallenge → App Attest / Play
 * Integrity → attestation_node.verify), and each grant is single use, so a
 * resend attests again. The request carries the sealed context when it can
 * be fetched, so the server throttles per connection rather than sharing one
 * budget per number with whoever else asks for it.
 */
export function useRequestPhoneCode() {
  const { language } = useI18n();
  const createChallenge = useAuditedMutation(api.attestation.createChallenge);
  const verifyAttestation = useAction(api.attestation_node.verify);
  const requestOtp = useMutation(api.phone_auth.requestPhoneAuthOtp);

  return useCallback(
    async (phoneNumber: string, intent: PhoneIntent) => {
      if (intent === "signup") {
        const { challengeId, challenge } = await createChallenge();
        try {
          const attestation = await attestDevice(challenge);
          await verifyAttestation({ challengeId, phoneNumber, ...attestation });
        } catch (error) {
          throw new AttestationFailed(
            error instanceof Error ? error.message : String(error),
          );
        }
      }
      await requestOtp({
        phoneNumber,
        intent,
        language: accountLanguageTag(language),
        _audit: await auditContext.get().catch(() => undefined),
      });
    },
    [createChallenge, verifyAttestation, requestOtp, language],
  );
}

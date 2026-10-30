import { useCallback } from "react";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@keeplas/backend/_generated/api";

import { accountLanguageTag } from "@/i18n/translate";
import { useI18n } from "@/providers/i18n-provider";
import { attestDevice } from "./attestation";
import { errorText, isAttestationRejection } from "./errors";
import { useAuditedMutation } from "./use-audited-mutation";

export type PhoneIntent = "signup" | "signin";

/**
 * Thrown when the device check failed. `transient` (offline, Apple or Google
 * busy): ask to try again. Otherwise the device was refused: show M09-9.
 */
export class AttestationFailed extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
  ) {
    super(message);
  }
}

/**
 * Send the WhatsApp sign-up / sign-in code. A sign-up code is only issued
 * after this phone attested itself (createChallenge → App Attest / Play
 * Integrity → attestation_node.verify), and each grant is single use, so a
 * resend attests again. The request carries the sealed context (added by
 * useAuditedMutation), so the server throttles per connection. A number
 * already taken (sign-up) comes back as `{ sent: false, error }` and is
 * thrown here, as the screens expect; an unknown number on sign-in gets the
 * same `{ sent: true }` as a known one (no account enumeration).
 */
export function useRequestPhoneCode() {
  const { language } = useI18n();
  const createChallenge = useAuditedMutation(api.attestation.createChallenge);
  const verifyAttestation = useAction(api.attestation_node.verify);
  const requestOtp = useAuditedMutation(api.phone_auth.requestPhoneAuthOtp);

  return useCallback(
    async (phoneNumber: string, intent: PhoneIntent) => {
      if (intent === "signup") {
        const { challengeId, challenge } = await createChallenge();
        try {
          const attestation = await attestDevice(challenge);
          await verifyAttestation({ challengeId, phoneNumber, ...attestation });
        } catch (error) {
          throw new AttestationFailed(
            errorText(error),
            !isAttestationRejection(error),
          );
        }
      }
      const result = await requestOtp({
        phoneNumber,
        intent,
        language: accountLanguageTag(language),
      });
      if (!result.sent) throw new ConvexError(result.error);
    },
    [createChallenge, verifyAttestation, requestOtp, language],
  );
}

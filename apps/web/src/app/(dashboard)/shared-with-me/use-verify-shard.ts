"use client";

import { useCallback, useState } from "react";
import { unwrapBytes } from "@keeplas/crypto/kem";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { api } from "@keeplas/backend/_generated/api";
import { useRecipientCrypto } from "@/lib/use-recipient-crypto";
import { useAuditedMutation } from "@/lib/use-audited-mutation";

export const VERIFICATION_PLAINTEXT = "KEEPLAS_VERIFY_OK";

export type VerifyStatus = "idle" | "running" | "ok" | "error";

interface VerifyArgs {
  contactId: Id<"trusted_contacts">;
  verificationEnvelope: string | undefined;
}

export function useVerifyShard() {
  const { ensureOwnerKeypair, isReady } = useRecipientCrypto();
  const confirmShardVerified = useAuditedMutation(
    api.trusted_contacts.confirmShardVerified
  );

  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(
    async ({ contactId, verificationEnvelope }: VerifyArgs) => {
      setError(null);
      setStatus("running");
      try {
        if (!verificationEnvelope) {
          throw new Error(
            "Owner hasn't enabled verification yet — try again later."
          );
        }
        const { secretKey } = await ensureOwnerKeypair();
        const plaintext = await unwrapBytes(verificationEnvelope, secretKey);
        const decoded = new TextDecoder().decode(plaintext);
        if (decoded !== VERIFICATION_PLAINTEXT) {
          throw new Error(
            "Verification failed — please contact the vault owner."
          );
        }
        await confirmShardVerified({ contactId });
        setStatus("ok");
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Verification failed — please contact the vault owner.";
        setError(message);
        setStatus("error");
      }
    },
    [ensureOwnerKeypair, confirmShardVerified]
  );

  return { verify, status, error, isReady };
}

"use client";

import { useEffect, useRef } from "react";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useRecipientCrypto } from "@/lib/use-recipient-crypto";
import { api } from "@keeplas/backend/_generated/api";

interface VaultWithKey {
  contactPublicKey?: string;
}

/**
 * Auto-publish the contact's ML-KEM public key on every shared-vault row
 * that's still missing one — covers contacts who accepted their invitation
 * before their crypto was ready (no `contactPublicKey` was sent then).
 *
 * Runs once per session: as soon as the recipient crypto becomes ready and
 * there's at least one row with no key, we trigger `republishContactPublicKey`
 * which idempotently patches all matching rows.
 */
export function useBackfillContactPublicKey(
  vaults: ReadonlyArray<VaultWithKey> | undefined
) {
  const { ensureOwnerKeypair, isReady } = useRecipientCrypto();
  const republish = useAuditedMutation(
    api.trusted_contacts.republishContactPublicKey
  );
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (!isReady || !vaults) return;
    const needsBackfill = vaults.some((v) => !v.contactPublicKey);
    if (!needsBackfill) return;
    ranRef.current = true;

    void (async () => {
      try {
        const { publicKeyB64 } = await ensureOwnerKeypair();
        await republish({ contactPublicKey: publicKeyB64 });
      } catch {
        // Swallow — the manual verify button will surface a clearer error.
        ranRef.current = false;
      }
    })();
  }, [isReady, vaults, ensureOwnerKeypair, republish]);
}

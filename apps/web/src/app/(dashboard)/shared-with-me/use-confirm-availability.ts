import { useEffect, useRef } from "react";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useRecipientCrypto } from "@/lib/use-recipient-crypto";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { STALE_VERIFICATION_THRESHOLD_MS } from "../trusted-contacts/contact-display";

interface IncomingVault {
  _id: Id<"trusted_contacts">;
  contactType?: "trust" | "recipient_only";
  invitationStatus: string;
  lastVerifiedAt?: number;
}

/**
 * For each vault that names the current user as an accepted trust contact,
 * stamp `lastVerifiedAt` once the contact's own key material unlocks on this
 * device — proof they can still open what the owner wraps to them. Bounded to
 * missing / stale stamps so it never spams mutations on every page load.
 */
export function useConfirmAvailability(
  vaults: ReadonlyArray<IncomingVault> | undefined,
): void {
  const { ensureOwnerKeypair, isReady } = useRecipientCrypto();
  const confirmAvailability = useAuditedMutation(
    api.trusted_contacts.confirmAvailability,
  );
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!isReady || !vaults || inFlightRef.current) return;

    const due = vaults.filter(
      (v) =>
        v.invitationStatus === "accepted" &&
        (v.contactType ?? "trust") === "trust" &&
        (!v.lastVerifiedAt ||
          Date.now() - v.lastVerifiedAt > STALE_VERIFICATION_THRESHOLD_MS),
    );
    if (due.length === 0) return;

    inFlightRef.current = true;
    void (async () => {
      try {
        await ensureOwnerKeypair();
        for (const vault of due) {
          await confirmAvailability({ contactId: vault._id });
        }
      } catch {
        // Non-fatal: the stamp is retried on the next visit.
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [vaults, isReady, ensureOwnerKeypair, confirmAvailability]);
}

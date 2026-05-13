"use client";

import { useEffect, useRef } from "react";
import { wrapBytes } from "@keeplas/crypto/kem";
import type { Doc, Id } from "@keeplas/backend/_generated/dataModel";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { VERIFICATION_PLAINTEXT } from "../shared-with-me/use-verify-shard";

/**
 * Lazily wrap a known plaintext to each accepted contact's ML-KEM public key
 * and persist the envelope. Runs once per contact id, on the owner's device,
 * after the contacts query resolves. Backfills records that pre-date the
 * verification feature and stays a no-op on subsequent renders.
 */
export function useBackfillVerificationEnvelopes(
  contacts: Doc<"trusted_contacts">[] | undefined,
) {
  const setVerificationEnvelope = useAuditedMutation(
    api.trusted_contacts.setVerificationEnvelope,
  );
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!contacts) return;

    const candidates = contacts.filter(
      (c) =>
        c.invitationStatus === "accepted" &&
        !!c.contactPublicKey &&
        !c.verificationEnvelope &&
        !inFlight.current.has(c._id),
    );
    if (candidates.length === 0) return;

    let cancelled = false;

    (async () => {
      const encoded = new TextEncoder().encode(VERIFICATION_PLAINTEXT);
      for (const contact of candidates) {
        if (cancelled) break;
        inFlight.current.add(contact._id);
        try {
          const envelope = await wrapBytes(encoded, contact.contactPublicKey!);
          if (cancelled) break;
          await setVerificationEnvelope({
            contactId: contact._id as Id<"trusted_contacts">,
            verificationEnvelope: envelope,
          });
        } catch {
          inFlight.current.delete(contact._id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contacts, setVerificationEnvelope]);
}

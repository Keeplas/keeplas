"use client";

import { useCallback } from "react";
import { useConfirm } from "@keeplas/ui";
import { useAuditedMutation } from "./use-audited-mutation";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import type { BlockedContact } from "./verify-contact-key";

/**
 * BLOCKING alert for verify-before-wrap failures (finding #2). When any
 * recipient's encryption key cannot be authenticated, the wrap MUST NOT be
 * silently skipped — the owner is shown a blocking dialog explaining why and,
 * for a deliberate identity-key change, offered an explicit re-pin.
 *
 * Returns `true` only when the caller may RETRY the wrap (the owner explicitly
 * re-pinned every changed contact). Returns `false` otherwise — the caller must
 * abort the save. This keeps the blocking policy in one place so every wrap
 * call site (vault items, shards, recovery, rotation) behaves identically.
 *
 * Policy:
 *  - `unverifiable`      → contact has no identity material. BLOCK: the contact
 *                          must finish setup / re-key. No re-pin offered.
 *  - `signature_invalid` → the ML-KEM key is not signed by the contact's
 *                          identity key. BLOCK: possible server tampering. No
 *                          re-pin offered (the signature, not the pin, is wrong).
 *  - `fingerprint_changed` → the identity key itself changed vs the pin.
 *                          BLOCK, but offer an explicit re-pin so a deliberate
 *                          re-key by the contact can be accepted by the owner.
 */
export function useBlockedWrapAlert(): (
  blocked: BlockedContact[],
) => Promise<boolean> {
  const confirm = useConfirm();
  const repin = useAuditedMutation(api.trusted_contacts.repinContactIdentity);

  return useCallback(
    async (blocked: BlockedContact[]): Promise<boolean> => {
      if (blocked.length === 0) return true;

      const names = (cs: BlockedContact[]) =>
        cs.map((c) => c.name?.trim() || "a contact").join(", ");

      const changed = blocked.filter((c) => c.reason === "fingerprint_changed");
      const hardFail = blocked.filter(
        (c) => c.reason !== "fingerprint_changed",
      );

      // Hard failures (unverifiable / signature_invalid) can never be accepted
      // here — they are not a deliberate, reviewable change. Surface them first.
      if (hardFail.length > 0) {
        const unverifiable = hardFail.filter((c) => c.reason === "unverifiable");
        const tampered = hardFail.filter(
          (c) => c.reason === "signature_invalid",
        );
        const lines: string[] = [];
        if (unverifiable.length > 0) {
          lines.push(
            `${names(unverifiable)} hasn't finished setting up their encryption keys. They must re-open Keeplas and publish their key before you can share with them.`,
          );
        }
        if (tampered.length > 0) {
          lines.push(
            `We could not verify the encryption key for ${names(tampered)}. This can mean the server tampered with their key. Sharing is blocked to protect your data.`,
          );
        }
        await confirm({
          title: "Can't verify a contact's encryption key",
          description: lines.join("\n\n"),
          confirmLabel: "OK",
          cancelLabel: "Close",
          variant: "destructive",
        });
        // Always abort: nothing the owner can fix from this dialog.
        return false;
      }

      // Deliberate-change path: the contact's identity key changed. Offer an
      // explicit re-pin — never auto-update the pin.
      const accepted = await confirm({
        title: "A contact's encryption identity changed",
        description: `The encryption identity for ${names(changed)} is different from the one you previously trusted. If they re-installed Keeplas or re-keyed, this is expected. If you did not expect this, it may be a sign of server tampering — do not continue. Re-trust this identity only if you recognise the change.`,
        confirmLabel: "Re-trust and continue",
        cancelLabel: "Cancel",
        variant: "destructive",
      });
      if (!accepted) return false;

      // Owner explicitly accepted: re-pin each changed contact to its new
      // fingerprint, then let the caller retry the wrap.
      for (const c of changed) {
        if (!c.newFingerprint) continue;
        await repin({
          contactId: c.contactId as Id<"trusted_contacts">,
          fingerprint: c.newFingerprint,
        });
      }
      return true;
    },
    [confirm, repin],
  );
}

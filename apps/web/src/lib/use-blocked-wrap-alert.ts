import { useCallback } from "react";
import { useConfirm } from "@keeplas/ui";
import { useAuditedMutation } from "./use-audited-mutation";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import type { BlockedContact } from "./use-recipient-crypto";

/** Blocks the owner may lift by explicitly re-trusting the identity. */
const isRetrustable = (c: BlockedContact) =>
  c.reason === "fingerprint_changed" || c.reason === "pin_unverified";

/**
 * BLOCKING alert for verify-before-wrap failures (finding #2). When any
 * recipient's encryption key cannot be authenticated, the wrap MUST NOT be
 * silently skipped — the owner is shown a blocking dialog explaining why and,
 * for an identity the owner can review, offered an explicit re-trust.
 *
 * Returns `true` only when the caller may RETRY the wrap (the owner explicitly
 * re-trusted every blocked contact). Returns `false` otherwise — the caller must
 * abort the save. This keeps the blocking policy in one place so every wrap
 * call site (vault items, rotation) behaves identically.
 *
 * Policy:
 *  - `unverifiable`      → contact has no identity material. BLOCK: the contact
 *                          must finish setup / re-key. No re-trust offered.
 *  - `signature_invalid` → the ML-KEM key is not signed by the contact's
 *                          identity key. BLOCK: possible server tampering. No
 *                          re-trust offered (the signature, not the pin, is wrong).
 *  - `fingerprint_changed` → the identity key itself changed vs the pin.
 *  - `pin_unverified`    → the owner's pin is missing on a contact already
 *                          shared with, or was altered on the server.
 *                          Both BLOCK, but offer an explicit re-trust so a
 *                          deliberate re-key by the contact can be accepted.
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

      const retrustable = blocked.filter(isRetrustable);
      const hardFail = blocked.filter((c) => !isRetrustable(c));

      // Hard failures (unverifiable / signature_invalid) can never be accepted
      // here — they are not a deliberate, reviewable change. Surface them first.
      if (hardFail.length > 0) {
        const unverifiable = hardFail.filter(
          (c) => c.reason === "unverifiable",
        );
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

      // Review path: offer an explicit re-trust — never auto-update the pin.
      const changed = retrustable.filter(
        (c) => c.reason === "fingerprint_changed",
      );
      const unconfirmed = retrustable.filter(
        (c) => c.reason === "pin_unverified",
      );
      const lines: string[] = [];
      if (changed.length > 0) {
        lines.push(
          `The encryption identity for ${names(changed)} is different from the one you previously trusted. If they re-installed Keeplas or re-keyed, this is expected.`,
        );
      }
      if (unconfirmed.length > 0) {
        lines.push(
          `We can't confirm that ${names(unconfirmed)} still has the encryption identity you trusted: the record of it is missing or was changed.`,
        );
      }
      lines.push(
        "If you did not expect this, it may be a sign of server tampering. Do not continue. Re-trust this identity only if you recognise the change.",
      );
      const accepted = await confirm({
        title: "Confirm a contact's encryption identity",
        description: lines.join("\n\n"),
        confirmLabel: "Re-trust and continue",
        cancelLabel: "Cancel",
        variant: "destructive",
      });
      if (!accepted) return false;

      // Owner explicitly accepted: re-pin each contact to the identity it now
      // presents, then let the caller retry the wrap.
      for (const c of retrustable) {
        if (!c.repin) continue;
        await repin({
          contactId: c.contactId as Id<"trusted_contacts">,
          ...c.repin,
        });
      }
      return true;
    },
    [confirm, repin],
  );
}

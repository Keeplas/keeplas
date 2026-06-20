import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { useRecipientCrypto } from "@/lib/use-recipient-crypto";
import { toWrapRecipient } from "@/lib/verify-contact-key";
import { useAuditedMutation } from "@/lib/use-audited-mutation";

/**
 * Owner-side re-wrap of deferred shares. When an item was saved with contacts
 * that hadn't published their encryption key yet (recorded as
 * `vault_items.pendingRecipients`), no wrapped DEK could be produced for them.
 * Because the DEK is sealed under the owner's master key and the server is
 * zero-access, only the owner's client can re-wrap it — so we do it here, the
 * next time the owner is online with the vault unlocked after those contacts
 * publish.
 *
 * Mirrors `useBackfillContactPublicKey` (the contact-side counterpart): the
 * reactive `getItemsNeedingRewrap` query surfaces only items whose pending
 * contacts are now publishable; for each we unwrap the DEK and re-wrap it to
 * them (verify-before-wrap + TOFU pinning are handled by `wrapExistingDek`),
 * then `addRecipientKeys` inserts the wraps and clears them from pending.
 *
 * The work-guard is keyed by item + the exact ready-contact set, so a later
 * publish by a *different* pending contact on the same item is picked up rather
 * than skipped. `addRecipientKeys` is idempotent server-side, so an overlapping
 * retry is harmless.
 */
export function useBackfillPendingShares() {
  const { isReady, unwrapOwnerDek, wrapExistingDek } = useRecipientCrypto();
  const items = useQuery(api.vault_items.getItemsNeedingRewrap);
  const addRecipientKeys = useAuditedMutation(api.vault_items.addRecipientKeys);
  const handled = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isReady || !items || items.length === 0) return;

    void (async () => {
      for (const item of items) {
        const key = `${item.itemId}:${item.readyContacts
          .map((c) => c._id)
          .sort()
          .join(",")}`;
        if (handled.current.has(key)) continue;
        handled.current.add(key);

        try {
          const dek = await unwrapOwnerDek({
            wrappedDek: item.ownerWrappedDek,
          });
          const { recipientWraps } = await wrapExistingDek(
            dek,
            item.readyContacts.map(toWrapRecipient),
          );
          if (recipientWraps.length === 0) continue;
          await addRecipientKeys({
            itemId: item.itemId as Id<"vault_items">,
            recipientKeys: recipientWraps.map((rw) => ({
              contactId: rw.contactId as Id<"trusted_contacts">,
              wrappedDek: rw.wrappedDek,
            })),
          });
        } catch {
          // Transient unwrap/verify/network failure — leave the item pending
          // and allow a retry on the next render by clearing the guard.
          handled.current.delete(key);
        }
      }
    })();
  }, [isReady, items, unwrapOwnerDek, wrapExistingDek, addRecipientKeys]);
}

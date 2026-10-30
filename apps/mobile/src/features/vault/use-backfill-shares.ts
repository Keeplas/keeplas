import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { wrapDek } from "@keeplas/crypto/kem";
import { contactKeyMaterial } from "@keeplas/crypto/sig";

import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useVerifiedKey } from "./use-contact-trust";
import { useVaultData } from "./vault-data";

/**
 * Owner-side re-wrap, as the web's useBackfillPendingShares: contacts owed an
 * item's key (deferred at save time, or added after an item shared with
 * everyone) get it wrapped on this phone once their key is published. Only
 * the owner can do it: the DEK is sealed to the owner and the server is
 * zero-access. A key that fails verification is skipped, never wrapped to.
 */
export function useBackfillShares() {
  const { itemKey } = useVaultData();
  const items = useQuery(api.vault_items.getItemsNeedingRewrap);
  const verifiedKey = useVerifiedKey();
  const addRecipientKeys = useAuditedMutation(api.vault_items.addRecipientKeys);
  // Keyed by item + contact set, so a later contact on the same item is
  // picked up; addRecipientKeys is idempotent if a retry overlaps.
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (!items?.length) return;
    void (async () => {
      for (const item of items) {
        const key = `${item.itemId}:${item.readyContacts
          .map((contact) => contact._id)
          .sort()
          .join(",")}`;
        if (handled.current.has(key)) continue;
        handled.current.add(key);
        try {
          const dek = await itemKey(item);
          const recipientKeys = [];
          for (const contact of item.readyContacts) {
            const publicKey = await verifiedKey(
              contactKeyMaterial(contact),
            ).catch(() => null);
            if (publicKey) {
              recipientKeys.push({
                contactId: contact._id,
                wrappedDek: await wrapDek(dek, publicKey),
              });
            }
          }
          if (recipientKeys.length) {
            await addRecipientKeys({ itemId: item.itemId, recipientKeys });
          }
        } catch {
          // Offline, locked or a transient failure: retry on the next update.
          handled.current.delete(key);
        }
      }
    })();
  }, [items, itemKey, verifiedKey, addRecipientKeys]);
}

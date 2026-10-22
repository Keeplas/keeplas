import { useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { toast } from "@keeplas/ui";
import { useTranslations } from "./i18n";
import { useMasterKey } from "./master-key-context";
import { useAuditedMutation } from "./use-audited-mutation";
import { useBlockedWrapAlert } from "./use-blocked-wrap-alert";
import { useRecipientCrypto } from "./use-recipient-crypto";
import { useVaultData } from "./vault-data";
import { toWrapRecipient, type BlockedContact } from "./verify-contact-key";

type ContactId = Id<"trusted_contacts">;

export interface ItemWraps {
  dek: CryptoKey;
  ownerWrappedDek: string;
  recipientKeys: { contactId: ContactId; wrappedDek: string }[];
  /** Contacts whose key isn't published yet: re-wrapped once they publish. */
  pendingRecipients: ContactId[];
  pendingNames: string[];
}

/** Item fields for "shared with these contacts", or private when none. */
export function sharingFields(contactIds: ContactId[]) {
  return contactIds.length > 0
    ? {
        accessLevel: "trusted_only" as const,
        recipientMode: "explicit" as const,
        sharedWithContacts: contactIds,
        sharedWithGroups: [],
      }
    : {
        accessLevel: "private" as const,
        recipientMode: "default" as const,
        sharedWithContacts: [],
        sharedWithGroups: [],
      };
}

const isHard = (blocked: BlockedContact) =>
  blocked.reason === "signature_invalid" ||
  blocked.reason === "fingerprint_changed";

/**
 * Wrapping an item key to the contacts who can open it (verify before wrap,
 * finding #2). A possible key substitution (bad signature, changed
 * fingerprint) blocks: the owner may re-pin once, otherwise `wrap` returns
 * null and nothing is saved. A contact who hasn't published a key yet is
 * deferred, not blocking (useBackfillPendingShares wraps it later).
 */
export function useItemSharing() {
  const t = useTranslations("vaultItem.sharing");
  const { masterKey } = useMasterKey();
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const { generateDekAndWrap, wrapExistingDek } = useRecipientCrypto();
  const showBlockedWrapAlert = useBlockedWrapAlert();

  const wrap = useCallback(
    async (
      contactIds: ContactId[],
      /** The item's DEK; a new one is generated when omitted. */
      existingDek?: CryptoKey,
    ): Promise<ItemWraps | null> => {
      // A legacy item opens with the master key itself: wrapping it to a
      // contact would hand them the whole vault. Such items need a DEK first.
      if (existingDek && existingDek === masterKey) {
        throw new Error("Legacy items can't be shared");
      }
      const recipients = [...new Set(contactIds)]
        .map((id) => contacts?.find((contact) => contact._id === id))
        .filter((contact) => contact !== undefined)
        .map(toWrapRecipient);
      const attempt = async () => {
        if (existingDek) {
          return {
            dek: existingDek,
            ...(await wrapExistingDek(existingDek, recipients)),
          };
        }
        return await generateDekAndWrap(recipients);
      };

      let result = await attempt();
      if (result.blocked.some(isHard)) {
        const retry = await showBlockedWrapAlert(result.blocked.filter(isHard));
        if (!retry) return null;
        result = await attempt();
        const hard = result.blocked.filter(isHard);
        if (hard.length > 0) {
          await showBlockedWrapAlert(hard);
          return null;
        }
      }
      const pending = result.blocked.filter(
        (blocked) => blocked.reason === "unverifiable",
      );
      return {
        dek: result.dek,
        ownerWrappedDek: result.ownerWrap.wrappedDek,
        recipientKeys: result.recipientWraps.map((recipient) => ({
          contactId: recipient.contactId as ContactId,
          wrappedDek: recipient.wrappedDek,
        })),
        pendingRecipients: pending.map(
          (blocked) => blocked.contactId as ContactId,
        ),
        pendingNames: pending.map((blocked) => blocked.name ?? ""),
      };
    },
    [
      masterKey,
      contacts,
      generateDekAndWrap,
      wrapExistingDek,
      showBlockedWrapAlert,
    ],
  );

  /** After a save: tell the owner which shares wait for a contact's key. */
  const announcePending = useCallback(
    (wraps: ItemWraps) => {
      if (wraps.pendingNames.length === 0) return;
      toast({
        title: t("pendingTitle"),
        description: t("pendingBody", {
          names: wraps.pendingNames.filter(Boolean).join(", "),
        }),
      });
    },
    [t],
  );

  return { wrap, announcePending };
}

/**
 * Move an item into a folder (or out with null): its DEK is wrapped to the
 * folder's grantees, whose access to the previous folder's items drops.
 * Returns false when the owner cancelled a blocked wrap.
 */
export function useMoveToFolder() {
  const { itemKey, folders } = useVaultData();
  const { wrap } = useItemSharing();
  const moveItem = useAuditedMutation(api.folders.moveItem);

  return useCallback(
    async (
      item: { _id: Id<"vault_items">; ownerWrappedDek?: string },
      folderId: Id<"folders"> | null,
    ): Promise<boolean> => {
      const grantees = (
        folders?.find((folder) => folder.id === folderId)?.grants ?? []
      ).map((grant) => grant.contactId);
      const wraps =
        grantees.length > 0 ? await wrap(grantees, await itemKey(item)) : null;
      if (grantees.length > 0 && !wraps) return false;
      await moveItem({
        itemId: item._id,
        folderId,
        recipientKeys: wraps?.recipientKeys ?? [],
      });
      return true;
    },
    [folders, itemKey, wrap, moveItem],
  );
}

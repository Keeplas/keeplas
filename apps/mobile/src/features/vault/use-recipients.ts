import { useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { wrapDek } from "@keeplas/crypto/kem";
import { contactKeyMaterial } from "@keeplas/crypto/sig";

import { ContactKeyBlocked } from "@/crypto/contact-keys";
import type { TranslateParams } from "@/i18n/translate";
import { useVerifiedKey } from "./use-contact-trust";

export function useWrapForContacts() {
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const verifiedKey = useVerifiedKey();

  return useCallback(
    (dek: CryptoKey, contactIds: Id<"trusted_contacts">[]) =>
      Promise.all(
        [...new Set(contactIds)].map(async (contactId) => {
          const contact = contacts?.find(
            (candidate) => candidate._id === contactId,
          );
          if (!contact) throw new Error("Contact unavailable");
          const publicKey = await verifiedKey(contactKeyMaterial(contact));
          return {
            contactId: contact._id,
            wrappedDek: await wrapDek(dek, publicKey),
          };
        }),
      ),
    [contacts, verifiedKey],
  );
}

/**
 * Keys for every trusted contact (the default access of an item), or only
 * `contactIds` when given: each verified key is returned to wrap to;
 * contacts who haven't published a key yet come back as `pending`. A key
 * that fails verification (possible substitution) throws
 * {@link ContactKeyBlocked}.
 */
export function useEveryoneRecipients() {
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const verifiedKey = useVerifiedKey();

  return useCallback(
    async (contactIds?: string[]) => {
      const recipients: {
        contactId: Id<"trusted_contacts">;
        publicKey: string;
      }[] = [];
      const pending: Id<"trusted_contacts">[] = [];
      for (const contact of contacts ?? []) {
        if (contactIds && !contactIds.includes(contact._id)) continue;
        const publicKey = await verifiedKey(contactKeyMaterial(contact)).catch(
          (error: unknown) => {
            if (
              error instanceof ContactKeyBlocked &&
              error.reason === "unverifiable"
            )
              return null;
            throw error;
          },
        );
        if (publicKey) recipients.push({ contactId: contact._id, publicKey });
        else pending.push(contact._id);
      }
      return { recipients, pending };
    },
    [contacts, verifiedKey],
  );
}

/**
 * Toast text for a contact Keeplas refused to encrypt an item for
 * ({@link ContactKeyBlocked}), naming them; null for any other error.
 */
export function contactKeyBlockedToast(
  error: unknown,
  t: (key: string, params?: TranslateParams) => string,
) {
  if (!(error instanceof ContactKeyBlocked)) return null;
  const name = error.contactName ?? "";
  return {
    title: t("capture.contactKeyTitle", { name }),
    description: t("capture.contactKeyBody", { name }),
  };
}

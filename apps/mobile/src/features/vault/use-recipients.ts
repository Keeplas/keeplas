import { useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { wrapDek } from "@keeplas/crypto/kem";

import {
  ContactKeyBlocked,
  contactKeyMaterial,
  requireVerifiedKey,
} from "@/crypto/contact-keys";
import { useAuditedMutation } from "@/lib/use-audited-mutation";

export function useWrapForContacts() {
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const pin = useAuditedMutation(api.trusted_contacts.pinContactIdentity);

  return useCallback(
    (dek: CryptoKey, contactIds: Id<"trusted_contacts">[]) =>
      Promise.all(
        [...new Set(contactIds)].map(async (contactId) => {
          const contact = contacts?.find(
            (candidate) => candidate._id === contactId,
          );
          if (!contact) throw new Error("Contact unavailable");
          const publicKey = await requireVerifiedKey(
            contactKeyMaterial(contact),
            (id, fingerprint) =>
              pin({
                contactId: id as Id<"trusted_contacts">,
                fingerprint,
              }),
          );
          return {
            contactId: contact._id,
            wrappedDek: await wrapDek(dek, publicKey),
          };
        }),
      ),
    [contacts, pin],
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
  const pin = useAuditedMutation(api.trusted_contacts.pinContactIdentity);

  return useCallback(
    async (contactIds?: string[]) => {
      const recipients: {
        contactId: Id<"trusted_contacts">;
        publicKey: string;
      }[] = [];
      const pending: Id<"trusted_contacts">[] = [];
      for (const contact of contacts ?? []) {
        if (contactIds && !contactIds.includes(contact._id)) continue;
        const publicKey = await requireVerifiedKey(
          contactKeyMaterial(contact),
          (id, fingerprint) =>
            pin({ contactId: id as Id<"trusted_contacts">, fingerprint }),
        ).catch((error: unknown) => {
          if (
            error instanceof ContactKeyBlocked &&
            error.reason === "unverifiable"
          )
            return null;
          throw error;
        });
        if (publicKey) recipients.push({ contactId: contact._id, publicKey });
        else pending.push(contact._id);
      }
      return { recipients, pending };
    },
    [contacts, pin],
  );
}

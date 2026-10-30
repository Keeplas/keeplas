import { useCallback, useMemo } from "react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  deriveContactTrust,
  type ContactKeyMaterial,
  type ContactTrust,
} from "@keeplas/crypto/sig";

import { requireVerifiedKey, type PersistPin } from "@/crypto/contact-keys";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";

/**
 * The signed-in owner's side of verify-before-wrap: the pin MAC key derived
 * from the unlocked MasterKey (null while locked) and the mutation that
 * persists pins.
 */
export function useContactTrust(): {
  trust: Promise<ContactTrust> | null;
  pin: PersistPin;
} {
  const viewer = useViewer();
  const { masterKey } = useVault();
  const pinIdentity = useAuditedMutation(
    api.trusted_contacts.pinContactIdentity,
  );
  const trust = useMemo(
    () => (masterKey ? deriveContactTrust(viewer._id, masterKey) : null),
    [viewer._id, masterKey],
  );
  const pin = useCallback<PersistPin>(
    (contactId, write) =>
      pinIdentity({ contactId: contactId as Id<"trusted_contacts">, ...write }),
    [pinIdentity],
  );
  return { trust, pin };
}

/**
 * A contact's authenticated ML-KEM key: verified, its pin persisted on first
 * use, or a {@link ContactKeyBlocked} thrown.
 */
export function useVerifiedKey(): (
  contact: ContactKeyMaterial,
) => Promise<string> {
  const { trust, pin } = useContactTrust();
  return useCallback(
    async (contact) => {
      if (!trust) throw new Error("Vault is locked");
      return requireVerifiedKey(contact, await trust, pin);
    },
    [trust, pin],
  );
}

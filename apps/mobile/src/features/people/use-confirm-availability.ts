import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { useVaultData } from "@/features/vault/vault-data";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { dueForConfirmation } from "./availability";

/**
 * Contact-side twin of the web's useConfirmAvailability: once my own keys
 * open on this phone, confirm I can still act for every vault that names me
 * as a trusted contact. It runs whenever the app is unlocked, not on one
 * screen, so a contact who only uses the phone stops getting reminders.
 */
export function useConfirmAvailability() {
  const { ownerKeys } = useVaultData();
  const vaults = useQuery(api.trusted_contacts.getVaultsWhereIAmContact);
  const confirm = useAuditedMutation(api.trusted_contacts.confirmAvailability);
  const running = useRef(false);

  useEffect(() => {
    if (!vaults || running.current) return;
    const due = dueForConfirmation(vaults, Date.now());
    if (due.length === 0) return;
    running.current = true;
    void (async () => {
      try {
        // The proof: the ML-KEM secret their items are wrapped to opens here.
        await ownerKeys();
        for (const vault of due) await confirm({ contactId: vault._id });
      } catch {
        // Offline, locked or a step-up pending: retried on the next update.
      } finally {
        running.current = false;
      }
    })();
  }, [vaults, ownerKeys, confirm]);
}

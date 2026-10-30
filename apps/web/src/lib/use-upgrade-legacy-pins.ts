import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  contactKeyMaterial,
  deriveContactTrust,
  legacyPinUpgrades,
} from "@keeplas/crypto/sig";
import { useMasterKey } from "./master-key-context";
import { useAuditedMutation } from "./use-audited-mutation";

/**
 * Owner-side migration of TOFU pins stored before pins were MACed: each one
 * that still matches the contact's identity gets the owner's MAC, once per
 * session, so it keeps verifying after LEGACY_PIN_UPGRADE_DEADLINE without a
 * re-trust prompt. The mobile app runs the same pass (use-upgrade-legacy-pins).
 */
export function useUpgradeLegacyPins() {
  const { masterKey } = useMasterKey();
  const viewer = useQuery(api.users.viewer);
  const [done, setDone] = useState(false);
  const contacts = useQuery(
    api.trusted_contacts.getContacts,
    done ? "skip" : {},
  );
  const pin = useAuditedMutation(api.trusted_contacts.pinContactIdentity);
  const running = useRef(false);

  useEffect(() => {
    if (done || running.current || !contacts || !masterKey || !viewer) return;
    running.current = true;
    void (async () => {
      try {
        const trust = await deriveContactTrust(viewer._id, masterKey);
        const upgrades = await legacyPinUpgrades(
          contacts.map(contactKeyMaterial),
          trust,
        );
        for (const upgrade of upgrades) {
          await pin({
            contactId: upgrade.contactId as Id<"trusted_contacts">,
            ...upgrade.pin,
          });
        }
        setDone(true);
      } catch {
        // Offline or locked: retried on the next update.
      } finally {
        running.current = false;
      }
    })();
  }, [done, contacts, masterKey, viewer, pin]);
}

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { contactKeyMaterial, legacyPinUpgrades } from "@keeplas/crypto/sig";

import { useContactTrust } from "./use-contact-trust";

/**
 * Owner-side migration of TOFU pins stored before pins were MACed, as the
 * web's useUpgradeLegacyPins: each one that still matches the contact's
 * identity gets the owner's MAC, once per session, so it keeps verifying after
 * LEGACY_PIN_UPGRADE_DEADLINE without a re-trust.
 */
export function useUpgradeLegacyPins() {
  const { trust, pin } = useContactTrust();
  const [done, setDone] = useState(false);
  const contacts = useQuery(
    api.trusted_contacts.getContacts,
    done ? "skip" : {},
  );
  const running = useRef(false);

  useEffect(() => {
    if (done || running.current || !contacts || !trust) return;
    running.current = true;
    void (async () => {
      try {
        const upgrades = await legacyPinUpgrades(
          contacts.map(contactKeyMaterial),
          await trust,
        );
        for (const upgrade of upgrades) {
          await pin(upgrade.contactId, upgrade.pin);
        }
        setDone(true);
      } catch {
        // Offline or locked: retried on the next update.
      } finally {
        running.current = false;
      }
    })();
  }, [done, contacts, trust, pin]);
}

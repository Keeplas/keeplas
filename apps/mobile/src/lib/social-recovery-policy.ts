import type { FunctionReturnType } from "convex/server";
import type { api } from "@keeplas/backend/_generated/api";
import {
  contactKeyMaterial,
  type ContactKeyMaterial,
} from "@keeplas/crypto/sig";

type Health = FunctionReturnType<typeof api.recovery.getHealth>;
type Targets = FunctionReturnType<typeof api.recovery.getSetupTargets>;

/** A setup target's keys, under the names verify-before-seal reads. */
export function targetKeyMaterial(
  target: Targets["contacts"][number],
): ContactKeyMaterial {
  return contactKeyMaterial({
    ...target,
    _id: target.contactId,
    contactPublicKey: target.publicKey,
    contactIdentityPublicKey: target.identityPublicKey,
    contactPublicKeySignature: target.publicKeySignature,
  });
}

export function contactsCanRecover(health: Health | undefined): boolean {
  return (
    !!health?.trustContacts.configured && !health.trustContacts.renewalRequired
  );
}

/**
 * Seal (or re-seal) as soon as one contact is ready: a single contact can
 * recover the account. A legacy 2-approval seal still works but is re-sealed
 * so one approval is enough.
 */
export function needsSocialRecoverySetup(
  health: Health | undefined,
  targets: Targets | undefined,
): boolean {
  if (!health || !targets || targets.contacts.length === 0) return false;
  return !contactsCanRecover(health) || health.trustContacts.upgradeRequired;
}

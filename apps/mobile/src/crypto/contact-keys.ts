/**
 * Verify-before-wrap (TOFU) on the phone. The checks themselves live in
 * @keeplas/crypto/sig (contact-trust.ts), shared with the web: the contact's
 * identity key must have signed its ML-KEM key, and its fingerprint must match
 * the pin the owner MACed on first use. This module turns a refusal into an
 * error the screens show, and persists the pins the verifier hands back.
 *
 * Any failure is blocking: callers never silently skip a contact.
 */
import {
  carryOverPin,
  verifyContactKey,
  type BlockReason,
  type ContactKeyMaterial,
  type ContactTrust,
  type PinWrite,
  type VerifyOutcome,
} from "@keeplas/crypto/sig";

/** Persist a pin (`trusted_contacts.pinContactIdentity`). */
export type PersistPin = (contactId: string, pin: PinWrite) => Promise<unknown>;

/** A contact the app refused to seal to, for the blocking alert. */
export class ContactKeyBlocked extends Error {
  constructor(
    readonly contactId: string,
    readonly reason: BlockReason,
    readonly contactName?: string,
  ) {
    super(`CONTACT_KEY_${reason.toUpperCase()}`);
  }
}

/** The authenticated key of `outcome`, its pin persisted, or a throw. */
async function requireKey(
  contact: ContactKeyMaterial,
  outcome: VerifyOutcome,
  pin: PersistPin,
): Promise<string> {
  if (outcome.status !== "ok") {
    throw new ContactKeyBlocked(
      contact.contactId,
      outcome.status,
      contact.name,
    );
  }
  if (outcome.pin) await pin(contact.contactId, outcome.pin);
  return outcome.contactPublicKey;
}

/**
 * Verify one contact and persist the pin on first use (or a legacy pin
 * upgrade). Returns the authenticated ML-KEM key or throws
 * {@link ContactKeyBlocked}.
 */
export async function requireVerifiedKey(
  contact: ContactKeyMaterial,
  trust: ContactTrust,
  pin: PersistPin,
): Promise<string> {
  return requireKey(contact, await verifyContactKey(contact, trust), pin);
}

/**
 * MasterKey rotation: as {@link requireVerifiedKey} under the current key
 * (`from`), persisting the pin MACed under the next one (`to`) so trust
 * survives the rotation.
 */
export async function requireCarriedOverKey(
  contact: ContactKeyMaterial,
  from: ContactTrust,
  to: ContactTrust,
  pin: PersistPin,
): Promise<string> {
  return requireKey(contact, await carryOverPin(contact, from, to), pin);
}

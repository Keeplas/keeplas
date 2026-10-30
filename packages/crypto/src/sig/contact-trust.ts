import { base64ToUint8, uint8ToBase64 } from "../encoding";
import { type KemBindingVersion, verifyKemBinding } from "./key-binding";
import { identityKeyFingerprint } from "./mldsa";

/**
 * Verify-before-wrap for contacts (malicious-server key substitution), shared
 * by the web and mobile apps. Before sealing anything to a contact (item DEK,
 * recovery share) the owner's device checks:
 *
 *  1. KEY BINDING: the contact's ML-DSA identity key signed this ML-KEM key
 *     (key-binding.ts), so a substituted encryption key is refused.
 *  2. AUTHENTICATED TOFU PIN: the identity-key fingerprint the owner trusted
 *     on first use. The pin is stored on the server (`trusted_contacts`), so
 *     it carries an HMAC under a key derived from the owner's MasterKey over
 *     (owner, contact row, fingerprint, binding version). The server can
 *     neither forge nor move a pin, only delete it, and a contact that already
 *     received wraps but has no valid pin is refused instead of silently
 *     re-trusted.
 *
 * Any failure is blocking: callers never silently skip a contact.
 */

const PIN_LABEL = "keeplas/contact-pin/v1";

/**
 * Pins stored before pins were MACed are upgraded silently (same identity →
 * MAC written) until this date. An unMACed pin is server-controlled, so after
 * it the owner must re-trust explicitly; clients upgrade every legacy pin on
 * unlock before then (`legacyPinUpgrades`).
 */
export const LEGACY_PIN_UPGRADE_DEADLINE = Date.UTC(2027, 1, 1);

/** The owner side of verification: who pins, and the pin MAC key. */
export interface ContactTrust {
  ownerId: string;
  pinKey: CryptoKey;
  /** Clock override (tests). */
  now?: number;
}

/** Key material of one of the owner's contacts, as the server returns it. */
export interface ContactKeyMaterial {
  contactId: string;
  /** The contact's account: v1 key bindings are signed for it. */
  contactUserId?: string;
  /** Display name, surfaced in the blocking alert. */
  name?: string;
  contactPublicKey?: string;
  contactIdentityPublicKey?: string;
  contactPublicKeySignature?: string;
  pinnedIdentityFingerprint?: string;
  /** Owner's MAC over the pin; absent on first use and on legacy pins. */
  pinnedIdentityMac?: string;
  /** The owner already sealed item keys or recovery shares to this contact. */
  hasWraps: boolean;
}

/** A pin to persist (`trusted_contacts.pinContactIdentity` / `repin…`). */
export interface PinWrite {
  fingerprint: string;
  mac: string;
}

export type VerifyOutcome =
  /**
   * Key authenticated: safe to wrap to `contactPublicKey`. `pin` is set on
   * first use or a legacy upgrade; the caller persists it.
   */
  | { status: "ok"; contactPublicKey: string; pin?: PinWrite }
  /** No identity material: the contact must finish setup / re-key. */
  | { status: "unverifiable" }
  /** The identity key did not sign this ML-KEM key: possible substitution. */
  | { status: "signature_invalid" }
  /**
   * The identity key differs from the pin (`fingerprint_changed`), or the
   * pin cannot be authenticated (`pin_unverified`: missing on a contact
   * already sealed to, altered, or legacy past the deadline). `repin` is the
   * pin to write only if the owner explicitly re-trusts this identity.
   */
  | { status: "fingerprint_changed" | "pin_unverified"; repin: PinWrite };

export type BlockReason = Exclude<VerifyOutcome["status"], "ok">;

/** The identity a contact's key verified under. */
interface Identity {
  fingerprint: string;
  version: KemBindingVersion;
}

const utf8 = (s: string) => new TextEncoder().encode(s);

/** Derive the owner's pin MAC key: HKDF-SHA-256(MasterKey, PIN_LABEL). */
export async function deriveContactTrust(
  ownerId: string,
  masterKey: CryptoKey,
): Promise<ContactTrust> {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", masterKey));
  try {
    const base = await crypto.subtle.importKey("raw", raw, "HKDF", false, [
      "deriveKey",
    ]);
    const pinKey = await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(0),
        info: utf8(PIN_LABEL),
      },
      base,
      { name: "HMAC", hash: "SHA-256", length: 256 },
      false,
      ["sign", "verify"],
    );
    return { ownerId, pinKey };
  } finally {
    raw.fill(0);
  }
}

const pinMessage = (trust: ContactTrust, contactId: string, id: Identity) =>
  utf8(
    `${PIN_LABEL}|${trust.ownerId}|${contactId}|${id.fingerprint}|${id.version}`,
  );

async function pinWrite(
  trust: ContactTrust,
  contactId: string,
  identity: Identity,
): Promise<PinWrite> {
  const mac = await crypto.subtle.sign(
    "HMAC",
    trust.pinKey,
    pinMessage(trust, contactId, identity),
  );
  return {
    fingerprint: identity.fingerprint,
    mac: uint8ToBase64(new Uint8Array(mac)),
  };
}

async function pinMacValid(
  trust: ContactTrust,
  contactId: string,
  identity: Identity,
  mac: string,
): Promise<boolean> {
  let tag: Uint8Array<ArrayBuffer>;
  try {
    tag = base64ToUint8(mac);
  } catch {
    return false;
  }
  // subtle.verify compares in constant time.
  return crypto.subtle.verify(
    "HMAC",
    trust.pinKey,
    tag,
    pinMessage(trust, contactId, identity),
  );
}

async function verifyWithIdentity(
  contact: ContactKeyMaterial,
  trust: ContactTrust,
): Promise<{ outcome: VerifyOutcome; identity?: Identity }> {
  if (
    !contact.contactPublicKey ||
    !contact.contactIdentityPublicKey ||
    !contact.contactPublicKeySignature
  ) {
    return { outcome: { status: "unverifiable" } };
  }
  // Layer 1: the identity key must have signed exactly this ML-KEM key.
  const version = await verifyKemBinding({
    identityPublicKey: contact.contactIdentityPublicKey,
    kemPublicKey: contact.contactPublicKey,
    signature: contact.contactPublicKeySignature,
    userId: contact.contactUserId,
  });
  if (version === null) return { outcome: { status: "signature_invalid" } };

  // Layer 2: the authenticated TOFU pin on the identity key.
  const identity: Identity = {
    fingerprint: await identityKeyFingerprint(contact.contactIdentityPublicKey),
    version,
  };
  const trusted = (pin?: PinWrite) => ({
    outcome: {
      status: "ok" as const,
      contactPublicKey: contact.contactPublicKey!,
      ...(pin ? { pin } : {}),
    },
    identity,
  });
  const blocked = async (status: "fingerprint_changed" | "pin_unverified") => ({
    outcome: {
      status,
      repin: await pinWrite(trust, contact.contactId, identity),
    },
  });

  const pin = contact.pinnedIdentityFingerprint;
  if (pin && pin !== identity.fingerprint) {
    return blocked("fingerprint_changed");
  }
  if (pin && contact.pinnedIdentityMac) {
    return (await pinMacValid(
      trust,
      contact.contactId,
      identity,
      contact.pinnedIdentityMac,
    ))
      ? trusted()
      : blocked("pin_unverified");
  }
  // No authenticated pin: a matching legacy pin before the deadline, or the
  // first use of a contact never sealed to, is trusted and pinned now.
  const legacyUpgrade =
    !!pin && (trust.now ?? Date.now()) < LEGACY_PIN_UPGRADE_DEADLINE;
  const firstUse = !pin && !contact.hasWraps;
  if (legacyUpgrade || firstUse) {
    return trusted(await pinWrite(trust, contact.contactId, identity));
  }
  return blocked("pin_unverified");
}

/**
 * Verify a contact's encryption key before wrapping to it. Never throws on
 * bad input: returns a blocking outcome the caller maps to UI.
 */
export async function verifyContactKey(
  contact: ContactKeyMaterial,
  trust: ContactTrust,
): Promise<VerifyOutcome> {
  return (await verifyWithIdentity(contact, trust)).outcome;
}

/**
 * Master-key rotation: verify under the current key (`from`) and return the
 * pin MACed under the next one (`to`), so trust survives the rotation.
 */
export async function carryOverPin(
  contact: ContactKeyMaterial,
  from: ContactTrust,
  to: ContactTrust,
): Promise<VerifyOutcome> {
  const { outcome, identity } = await verifyWithIdentity(contact, from);
  if (outcome.status !== "ok" || !identity) return outcome;
  return { ...outcome, pin: await pinWrite(to, contact.contactId, identity) };
}

/** Legacy (unMACed) pins that still match, with the MACed pin to store. */
export async function legacyPinUpgrades(
  contacts: ContactKeyMaterial[],
  trust: ContactTrust,
): Promise<{ contactId: string; pin: PinWrite }[]> {
  const upgrades = [];
  for (const contact of contacts) {
    if (!contact.pinnedIdentityFingerprint || contact.pinnedIdentityMac) {
      continue;
    }
    const outcome = await verifyContactKey(contact, trust);
    if (outcome.status === "ok" && outcome.pin) {
      upgrades.push({ contactId: contact.contactId, pin: outcome.pin });
    }
  }
  return upgrades;
}

/**
 * Build {@link ContactKeyMaterial} from a contact row (or any shape with the
 * same fields), so every wrap call site forwards the full key material.
 */
export function contactKeyMaterial(c: {
  _id: string;
  contactUserId?: string;
  name?: string;
  contactPublicKey?: string;
  contactIdentityPublicKey?: string;
  contactPublicKeySignature?: string;
  pinnedIdentityFingerprint?: string;
  pinnedIdentityMac?: string;
  hasWraps: boolean;
}): ContactKeyMaterial {
  return {
    contactId: c._id,
    contactUserId: c.contactUserId,
    name: c.name,
    contactPublicKey: c.contactPublicKey,
    contactIdentityPublicKey: c.contactIdentityPublicKey,
    contactPublicKeySignature: c.contactPublicKeySignature,
    pinnedIdentityFingerprint: c.pinnedIdentityFingerprint,
    pinnedIdentityMac: c.pinnedIdentityMac,
    hasWraps: c.hasWraps,
  };
}

/**
 * Verify-before-wrap (TOFU), same rules as apps/web/src/lib/verify-contact-key.ts.
 * Before sealing anything to a contact (item DEK, folder name, recovery
 * share) the app checks that:
 *
 *  1. the contact's ML-DSA identity key signed exactly this ML-KEM key, so a
 *     server-substituted encryption key is refused;
 *  2. the identity key matches the fingerprint the owner pinned on first use,
 *     so a substituted identity key is refused too.
 *
 * Any failure is blocking: callers never silently skip a contact.
 */
import { parsePublicKey } from "@keeplas/crypto/kem";
import { identityKeyFingerprint, verifyBytes } from "@keeplas/crypto/sig";

export interface ContactKeyMaterial {
  contactId: string;
  name?: string;
  contactPublicKey?: string;
  contactIdentityPublicKey?: string;
  contactPublicKeySignature?: string;
  /** Owner's pin; undefined on first use. */
  pinnedIdentityFingerprint?: string;
}

export type VerifyOutcome =
  | { status: "ok"; contactPublicKey: string; pinFingerprint?: string }
  | { status: "unverifiable" }
  | { status: "signature_invalid" }
  | { status: "fingerprint_changed"; newFingerprint: string };

export type BlockReason = Exclude<VerifyOutcome["status"], "ok">;

export async function verifyContactKey(
  contact: ContactKeyMaterial,
): Promise<VerifyOutcome> {
  if (
    !contact.contactPublicKey ||
    !contact.contactIdentityPublicKey ||
    !contact.contactPublicKeySignature
  ) {
    return { status: "unverifiable" };
  }
  let keyBytes: Uint8Array;
  try {
    keyBytes = parsePublicKey(contact.contactPublicKey);
  } catch {
    return { status: "signature_invalid" };
  }
  if (
    !verifyBytes(
      contact.contactIdentityPublicKey,
      keyBytes,
      contact.contactPublicKeySignature,
    )
  ) {
    return { status: "signature_invalid" };
  }
  const fingerprint = await identityKeyFingerprint(
    contact.contactIdentityPublicKey,
  );
  if (!contact.pinnedIdentityFingerprint) {
    return {
      status: "ok",
      contactPublicKey: contact.contactPublicKey,
      pinFingerprint: fingerprint,
    };
  }
  if (contact.pinnedIdentityFingerprint !== fingerprint) {
    return { status: "fingerprint_changed", newFingerprint: fingerprint };
  }
  return { status: "ok", contactPublicKey: contact.contactPublicKey };
}

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

/**
 * Verify one contact and persist the TOFU pin on first use. Returns the
 * authenticated ML-KEM key or throws {@link ContactKeyBlocked}.
 */
export async function requireVerifiedKey(
  contact: ContactKeyMaterial,
  pin: (contactId: string, fingerprint: string) => Promise<unknown>,
): Promise<string> {
  const outcome = await verifyContactKey(contact);
  if (outcome.status !== "ok") {
    throw new ContactKeyBlocked(
      contact.contactId,
      outcome.status,
      contact.name,
    );
  }
  if (outcome.pinFingerprint) {
    await pin(contact.contactId, outcome.pinFingerprint);
  }
  return outcome.contactPublicKey;
}

/** Key material of a `trusted_contacts` row. */
export function contactKeyMaterial(c: {
  _id: string;
  name?: string;
  contactPublicKey?: string;
  contactIdentityPublicKey?: string;
  contactPublicKeySignature?: string;
  pinnedIdentityFingerprint?: string;
}): ContactKeyMaterial {
  return {
    contactId: c._id,
    name: c.name,
    contactPublicKey: c.contactPublicKey,
    contactIdentityPublicKey: c.contactIdentityPublicKey,
    contactPublicKeySignature: c.contactPublicKeySignature,
    pinnedIdentityFingerprint: c.pinnedIdentityFingerprint,
  };
}

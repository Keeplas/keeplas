"use client";

import { parsePublicKey } from "@keeplas/crypto/kem";
import { verifyBytes, identityKeyFingerprint } from "@keeplas/crypto/sig";

/**
 * Verify-before-wrap (finding #2 — malicious-server ML-KEM key substitution).
 *
 * A malicious server could swap a contact's stored `contactPublicKey` for one
 * whose secret key it controls, silently making itself a recipient of every
 * DEK/shard wrapped to that contact. We defend with two layers:
 *
 *  1. SIGNATURE: the contact signs their ML-KEM public-key bytes with their
 *     long-lived ML-DSA identity key. We verify that signature before wrapping.
 *     A substituted ML-KEM key has no valid signature from the contact's
 *     identity key, so verification fails.
 *
 *  2. TOFU PIN: the owner pins the contact's identity-key fingerprint on first
 *     successful verify. If the identity key itself later changes, the
 *     recomputed fingerprint differs from the pin — a possible server swap of
 *     the *identity* key too — and we refuse until the owner explicitly re-pins.
 *
 * Any failure is BLOCKING: callers must not silently skip the contact.
 */

/** Server-provided contact key material consumed by the verifier. */
export interface ContactKeyMaterial {
  contactId: string;
  /** Display name, surfaced in the blocking alert. */
  name?: string;
  /** ML-KEM-768 public key to wrap to (base64). */
  contactPublicKey?: string;
  /** ML-DSA-65 identity public key (base64). */
  contactIdentityPublicKey?: string;
  /** ML-DSA signature over the ML-KEM public-key bytes (base64). */
  contactPublicKeySignature?: string;
  /**
   * Owner's pinned fingerprint of the identity key, when this is one of the
   * owner's own contact rows. Undefined for peer rows (recovery rewrap), where
   * pinning is not the caller's responsibility.
   */
  pinnedIdentityFingerprint?: string;
}

export type VerifyOutcome =
  /**
   * Key authenticated — safe to wrap to `contactPublicKey`. When
   * `pinFingerprint` is present this was a first successful verify with no pin
   * yet: the caller (owner) should persist it via `pinContactIdentity` before
   * treating the wrap as final. Peers (no pin concept) ignore it.
   */
  | { status: "ok"; contactPublicKey: string; pinFingerprint?: string }
  /** Contact has no identity material — cannot be authenticated. Must finish setup / re-key. */
  | { status: "unverifiable" }
  /** Signature did not verify — possible server substitution of the ML-KEM key. */
  | { status: "signature_invalid" }
  /**
   * Identity-key fingerprint differs from the owner's pin — possible server
   * substitution of the identity key. Carries the new fingerprint so the owner
   * can review it and explicitly re-pin.
   */
  | { status: "fingerprint_changed"; newFingerprint: string };

/**
 * Verify a contact's encryption key before wrapping to it. Pure and async
 * (fingerprint hashing is async). Never throws on bad input — returns a
 * blocking outcome the caller maps to UI.
 */
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

  // Layer 1: the identity key must have signed exactly these ML-KEM bytes.
  let pubKeyBytes: Uint8Array;
  try {
    pubKeyBytes = parsePublicKey(contact.contactPublicKey);
  } catch {
    return { status: "signature_invalid" };
  }
  const signatureValid = verifyBytes(
    contact.contactIdentityPublicKey,
    pubKeyBytes,
    contact.contactPublicKeySignature,
  );
  if (!signatureValid) {
    return { status: "signature_invalid" };
  }

  // Layer 2: TOFU pin on the identity key.
  const fingerprint = await identityKeyFingerprint(
    contact.contactIdentityPublicKey,
  );
  if (!contact.pinnedIdentityFingerprint) {
    // First trust: caller should pin `fingerprint`. Peers (no pin concept)
    // simply ignore the returned `pinFingerprint`.
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

/**
 * Build a {@link ContactKeyMaterial} from a `trusted_contacts` row (or any
 * shape carrying the same fields). Centralizes the field plumbing so every
 * wrap call site forwards the full identity material, not just the ML-KEM key.
 */
export function toWrapRecipient(c: {
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

/** A contact whose key could not be authenticated, for the blocking alert. */
export interface BlockedContact {
  contactId: string;
  name?: string;
  reason: "unverifiable" | "signature_invalid" | "fingerprint_changed";
  /** Present only for `fingerprint_changed` — the new fingerprint to re-pin. */
  newFingerprint?: string;
}

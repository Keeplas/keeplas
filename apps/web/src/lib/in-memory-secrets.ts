/**
 * Module-scoped holder for the unwrapped owner secret keys that live in memory
 * while the vault is unlocked (the ML-KEM encryption secret key, its rotation
 * predecessor, and the ML-DSA identity secret key). They are unwrapped from the
 * server bundle under the MasterKey by use-recipient-crypto.ts and cached here
 * so signing/wrapping does not re-prompt mid-session.
 *
 * Centralising them here (instead of in per-hook useRefs) gives a SINGLE place
 * the lock chokepoint can wipe — clearInMemorySecrets() is called from
 * MasterKeyProvider.lock() alongside clearing the MasterKey, so an inactivity
 * auto-lock or sign-out leaves no decrypted secret material behind.
 *
 * Exposed as plain functions (not a mutable object) so React-hook consumers can
 * read/write without the value being tracked as hook-immutable state.
 */

interface InMemorySecrets {
  /** Owner ML-KEM-768 secret key bytes. */
  ownerSecretKey: Uint8Array | null;
  /** Owner ML-KEM-768 public key (base64). */
  ownerPublicKeyB64: string | null;
  /** Owner ML-DSA-65 identity secret key (base64). */
  ownerIdentitySecretKeyB64: string | null;
  /** Previous owner ML-KEM secret key, set only during a master-key rotation. */
  ownerPrevSecretKey: Uint8Array | null;
}

const secrets: InMemorySecrets = {
  ownerSecretKey: null,
  ownerPublicKeyB64: null,
  ownerIdentitySecretKeyB64: null,
  ownerPrevSecretKey: null,
};

/** Read the current cached secret material (live reference, do not mutate). */
export function readInMemorySecrets(): Readonly<InMemorySecrets> {
  return secrets;
}

/** Patch one or more fields of the cached secret material. */
export function setInMemorySecrets(patch: Partial<InMemorySecrets>): void {
  Object.assign(secrets, patch);
}

/**
 * Wipe all cached decrypted secret material. Called by the vault lock
 * chokepoint (sign-out, session loss, inactivity auto-lock). After this the
 * next crypto operation re-unwraps from the bundle — which requires the
 * MasterKey, which the same lock just cleared, forcing a re-unlock.
 */
export function clearInMemorySecrets(): void {
  secrets.ownerSecretKey = null;
  secrets.ownerPublicKeyB64 = null;
  secrets.ownerIdentitySecretKeyB64 = null;
  secrets.ownerPrevSecretKey = null;
}

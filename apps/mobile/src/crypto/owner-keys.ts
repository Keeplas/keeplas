/**
 * The owner's long-lived key pairs, unwrapped from `users` with the
 * MasterKey: ML-KEM-768 (item DEKs, folder names, shares sealed to me) and
 * the ML-DSA-65 identity (signatures). During a master-key rotation the
 * previous ML-KEM secret is kept too, so items not yet re-encrypted still
 * open (apps/web/src/lib/use-recipient-crypto.ts).
 *
 * Unwrapped secrets live in memory only, in one cache that the vault lock
 * clears ({@link forgetOwnerKeys}).
 */
import { parseSecretKey, unwrapDek } from "@keeplas/crypto/kem";

import { decryptText } from "./envelope";

export interface OwnerKeyFields {
  _id: string;
  publicKey?: string;
  encryptedAsymmetricSecretKey?: string;
  encryptedAsymmetricSecretKeyPrev?: string;
  encryptedIdentitySecretKey?: string;
}

export interface OwnerKeys {
  publicKey: string;
  secretKey: Uint8Array;
  prevSecretKey: Uint8Array | null;
  identitySecretKey: string | null;
}

let cache: {
  id: string;
  masterKey: CryptoKey;
  keys: Promise<OwnerKeys>;
} | null = null;

const cacheId = (u: OwnerKeyFields) =>
  [
    u._id,
    u.publicKey,
    u.encryptedAsymmetricSecretKey,
    u.encryptedAsymmetricSecretKeyPrev,
  ].join("|");

async function unwrapAll(
  user: OwnerKeyFields,
  masterKey: CryptoKey,
): Promise<OwnerKeys> {
  if (!user.publicKey || !user.encryptedAsymmetricSecretKey) {
    throw new Error("Account has no encryption key yet");
  }
  const secret = (wrapped: string) =>
    decryptText(wrapped, masterKey).then(parseSecretKey);
  return {
    publicKey: user.publicKey,
    secretKey: await secret(user.encryptedAsymmetricSecretKey),
    prevSecretKey: user.encryptedAsymmetricSecretKeyPrev
      ? await secret(user.encryptedAsymmetricSecretKeyPrev)
      : null,
    identitySecretKey: user.encryptedIdentitySecretKey
      ? await decryptText(user.encryptedIdentitySecretKey, masterKey)
      : null,
  };
}

/** Owner keys for this MasterKey (unwrapped once, then cached). */
export function loadOwnerKeys(
  user: OwnerKeyFields,
  masterKey: CryptoKey,
): Promise<OwnerKeys> {
  const id = cacheId(user);
  if (cache?.id !== id || cache.masterKey !== masterKey) {
    const keys = unwrapAll(user, masterKey);
    cache = { id, masterKey, keys };
    keys.catch(() => {
      if (cache?.keys === keys) cache = null;
    });
  }
  return cache.keys;
}

/** Wipe the cached secrets (vault lock, sign-out, rotation). */
export function forgetOwnerKeys(): void {
  const old = cache;
  cache = null;
  old?.keys
    .then((k) => {
      k.secretKey.fill(0);
      k.prevSecretKey?.fill(0);
    })
    .catch(() => undefined);
}

/** Open an item DEK wrapped to me, falling back to the pre-rotation key. */
export async function unwrapOwnerDek(
  wrappedDek: string,
  keys: OwnerKeys,
): Promise<CryptoKey> {
  try {
    return await unwrapDek(wrappedDek, keys.secretKey);
  } catch (error) {
    if (keys.prevSecretKey) return unwrapDek(wrappedDek, keys.prevSecretKey);
    throw error;
  }
}

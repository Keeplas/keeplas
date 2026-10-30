/**
 * The owner's long-lived key pairs, unwrapped from `users` with the
 * MasterKey (the ML-KEM public key is checked against its secret key):
 * ML-KEM-768 (item DEKs, folder names, shares sealed to me) and
 * the ML-DSA-65 identity (signatures). Every ML-KEM secret retired by a
 * master-key rotation is kept too (`…Prev` during one, the retired-key
 * archive after), so wraps sealed to an older key still open: items not yet
 * re-wrapped, items and recovery shares other owners sealed to me
 * (packages/convex/rotation.ts).
 *
 * Unwrapped secrets live in memory only, in one cache that the vault lock
 * clears ({@link forgetOwnerKeys}).
 */
import {
  parseSecretKey,
  serializeSecretKey,
  unwrapDek,
  verifiedOwnerPublicKey,
} from "@keeplas/crypto/kem";

import { decryptText, encryptText } from "./envelope";

export interface OwnerKeyFields {
  _id: string;
  publicKey?: string;
  encryptedAsymmetricSecretKey?: string;
  encryptedAsymmetricSecretKeyPrev?: string;
  encryptedRetiredSecretKeys?: string;
  encryptedIdentitySecretKey?: string;
}

export interface OwnerKeys {
  publicKey: string;
  secretKey: Uint8Array;
  /** Retired ML-KEM secrets, newest first (`…Prev`, then the archive). */
  previousSecretKeys: Uint8Array[];
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
    u.encryptedRetiredSecretKeys,
  ].join("|");

/**
 * Seal retired ML-KEM secrets under the MasterKey, each once
 * (`users.encryptedRetiredSecretKeys`).
 */
export function sealRetiredSecretKeys(
  secretKeys: Uint8Array[],
  masterKey: CryptoKey,
): Promise<string> {
  const unique = [...new Set(secretKeys.map(serializeSecretKey))];
  return encryptText(JSON.stringify(unique), masterKey);
}

async function openRetiredSecretKeys(
  sealed: string,
  masterKey: CryptoKey,
): Promise<Uint8Array[]> {
  const list = JSON.parse(await decryptText(sealed, masterKey)) as string[];
  return list.map(parseSecretKey);
}

async function unwrapAll(
  user: OwnerKeyFields,
  masterKey: CryptoKey,
): Promise<OwnerKeys> {
  if (!user.publicKey || !user.encryptedAsymmetricSecretKey) {
    throw new Error("Account has no encryption key yet");
  }
  const secret = (wrapped: string) =>
    decryptText(wrapped, masterKey).then(parseSecretKey);
  const secretKey = await secret(user.encryptedAsymmetricSecretKey);
  return {
    // Owner wraps go to the key the authenticated secret key embeds, never to
    // a server-published copy that differs.
    publicKey: verifiedOwnerPublicKey(secretKey, user.publicKey),
    secretKey,
    previousSecretKeys: [
      ...(user.encryptedAsymmetricSecretKeyPrev
        ? [await secret(user.encryptedAsymmetricSecretKeyPrev)]
        : []),
      ...(user.encryptedRetiredSecretKeys
        ? await openRetiredSecretKeys(
            user.encryptedRetiredSecretKeys,
            masterKey,
          )
        : []),
    ],
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

/**
 * Whether this MasterKey opens the account's current owner key. False on a
 * device that kept the MasterKey from before a rotation made elsewhere.
 */
export async function opensOwnerKey(
  user: Pick<OwnerKeyFields, "encryptedAsymmetricSecretKey">,
  masterKey: CryptoKey,
): Promise<boolean> {
  if (!user.encryptedAsymmetricSecretKey) return true;
  return decryptText(user.encryptedAsymmetricSecretKey, masterKey).then(
    () => true,
    () => false,
  );
}

/** Wipe the cached secrets (vault lock, sign-out, rotation). */
export function forgetOwnerKeys(): void {
  const old = cache;
  cache = null;
  old?.keys
    .then((k) => {
      k.secretKey.fill(0);
      for (const key of k.previousSecretKeys) key.fill(0);
    })
    .catch(() => undefined);
}

/**
 * Run `open` with the current ML-KEM secret, then each retired one, until one
 * succeeds: for anything sealed to me, whichever key it was sealed to.
 */
export async function withOwnerSecret<T>(
  keys: Pick<OwnerKeys, "secretKey" | "previousSecretKeys">,
  open: (secretKey: Uint8Array) => Promise<T>,
): Promise<T> {
  try {
    return await open(keys.secretKey);
  } catch (error) {
    for (const previous of keys.previousSecretKeys) {
      try {
        return await open(previous);
      } catch {
        // Try the next older key.
      }
    }
    throw error;
  }
}

/** Open an item DEK wrapped to me, falling back to the retired keys. */
export function unwrapOwnerDek(
  wrappedDek: string,
  keys: Pick<OwnerKeys, "secretKey" | "previousSecretKeys">,
): Promise<CryptoKey> {
  return withOwnerSecret(keys, (secretKey) => unwrapDek(wrappedDek, secretKey));
}

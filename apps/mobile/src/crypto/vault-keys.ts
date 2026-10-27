/**
 * Vault key material, byte-for-byte what the web onboarding produces
 * (apps/web/src/app/(onboarding)/onboarding/steps/{verification,key-generation}
 * -step.tsx and apps/web/src/lib/use-recipient-crypto.ts), so a vault created
 * on the phone opens on the web and vice versa:
 *
 *   phrase      24 BIP-39 words (the optional recovery kit)
 *   phraseSalt  16 random bytes, shared by the verifier and the RootKey
 *   verifier    derivePhraseVerifier(phrase, salt)  → users.recoveryPhraseHash
 *   RootKey     Argon2id(phrase, salt)
 *   bundle      {version 2, phraseSalt, iv, encryptedMasterKey} = AES-GCM(RootKey, MasterKey)
 *   ML-KEM-768 + ML-DSA-65 secret keys wrapped under the MasterKey as
 *   {ciphertext, iv}; the ML-KEM public key signed with the identity key.
 *
 * Platform independent: only WebCrypto + @keeplas/crypto.
 */
import { generateMasterKey } from "@keeplas/crypto/aes";
import { base64ToUint8, uint8ToBase64 } from "@keeplas/crypto/encoding";
import { deriveRootKey } from "@keeplas/crypto/kdf";
import {
  generateRecipientKeyPair,
  parsePublicKey,
  serializePublicKey,
  serializeSecretKey,
} from "@keeplas/crypto/kem";
import {
  derivePhraseVerifier,
  generatePhrase,
  generatePhraseVerifierSalt,
} from "@keeplas/crypto/recovery";
import { generateIdentityKeyPair, signBytes } from "@keeplas/crypto/sig";

import {
  decryptText,
  encryptText,
  exportRawKey,
  fresh,
  importAesKey,
} from "./envelope";

export const KEY_BUNDLE_VERSION = 2;

interface KeyBundle {
  version: number;
  phraseSalt: string;
  iv: string;
  encryptedMasterKey: string;
}

/** Arguments of `users.setPublicKey`. */
export interface PublicKeyMaterial {
  publicKey: string;
  encryptedAsymmetricSecretKey: string;
  identityPublicKey: string;
  encryptedIdentitySecretKey: string;
  publicKeySignature: string;
}

export interface VaultMaterial extends KitMaterial {
  publicKeys: PublicKeyMaterial;
  /** Raw 32-byte MasterKey, wrapped for this device right after. */
  rawMasterKey: Uint8Array;
  /** ML-DSA identity secret (base64) for pairing signatures this session. */
  identitySecretKey: string;
}

export function importMasterKey(raw: Uint8Array): Promise<CryptoKey> {
  return importAesKey(raw, true);
}

/** AES-GCM wrap a base64 secret under the MasterKey → `{ciphertext, iv}` JSON. */
export const wrapSecretUnderMasterKey = encryptText;

/** Inverse of {@link wrapSecretUnderMasterKey}: returns the base64 secret. */
export const unwrapSecretUnderMasterKey = decryptText;

/** RootKey = Argon2id(24 words, phraseSalt), as raw bytes (kept on the phone). */
export async function deriveRawRootKey(
  phrase: string | string[],
  salt: Uint8Array,
): Promise<Uint8Array> {
  return exportRawKey(await deriveRootKey(phrase, salt, { extractable: true }));
}

/** Wrap the raw MasterKey under the RootKey into a v2 key bundle (JSON). */
export async function buildKeyBundle(
  rawMasterKey: Uint8Array,
  rawRootKey: Uint8Array,
  phraseSalt: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await importAesKey(rawRootKey),
    fresh(rawMasterKey),
  );
  const bundle: KeyBundle = {
    version: KEY_BUNDLE_VERSION,
    phraseSalt,
    iv: uint8ToBase64(iv),
    encryptedMasterKey: uint8ToBase64(new Uint8Array(wrapped)),
  };
  return JSON.stringify(bundle);
}

function parseKeyBundle(encryptedKeyBundle: string): KeyBundle {
  const bundle = JSON.parse(encryptedKeyBundle) as Partial<KeyBundle> & {
    wrappingKey?: string;
  };
  if (
    "wrappingKey" in bundle ||
    !bundle.phraseSalt ||
    !bundle.iv ||
    !bundle.encryptedMasterKey
  ) {
    throw new Error("Unsupported key bundle");
  }
  return bundle as KeyBundle;
}

/**
 * Open a v2 key bundle with the RootKey (cloud restore, or the RootKey kept
 * on this phone). A wrong key fails the AES-GCM tag check and throws.
 */
export async function openKeyBundleWithRootKey(
  encryptedKeyBundle: string,
  rawRootKey: Uint8Array,
): Promise<Uint8Array> {
  const bundle = parseKeyBundle(encryptedKeyBundle);
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToUint8(bundle.iv) },
    await importAesKey(rawRootKey),
    base64ToUint8(bundle.encryptedMasterKey),
  );
  return new Uint8Array(raw);
}

/**
 * Open a v2 key bundle with the 24 words (recovery kit entry on a new
 * phone). Returns the MasterKey and the RootKey, both raw.
 */
export async function openKeyBundle(
  encryptedKeyBundle: string,
  phrase: string | string[],
): Promise<{ masterKey: Uint8Array; rootKey: Uint8Array }> {
  const bundle = parseKeyBundle(encryptedKeyBundle);
  const rootKey = await deriveRawRootKey(
    phrase,
    base64ToUint8(bundle.phraseSalt),
  );
  try {
    return {
      masterKey: await openKeyBundleWithRootKey(encryptedKeyBundle, rootKey),
      rootKey,
    };
  } catch (error) {
    rootKey.fill(0);
    throw error;
  }
}

/** A recovery kit for an existing MasterKey: what `onboarding.store*` take. */
export interface KitMaterial {
  /** Shown once as the recovery kit; never sent anywhere. */
  phrase: string[];
  phraseSalt: string;
  /** `onboarding.storeRecoveryPhraseHash.recoveryPhraseHash`. */
  recoveryPhraseHash: string;
  /** `onboarding.storeKeyBundle.encryptedKeyBundle`. */
  encryptedKeyBundle: string;
  /** Raw RootKey, kept behind this phone's screen lock. */
  rawRootKey: Uint8Array;
}

/**
 * New 24 words + salt → RootKey → bundle sealing `rawMasterKey`. Used at
 * vault creation and to replace a lost kit (after a recovery): storing it
 * makes the previous words useless. `words` reuses given ones instead (the
 * store review demo accounts share one kit); the salt is always new.
 */
export async function createKitMaterial(
  rawMasterKey: Uint8Array,
  words?: string[],
): Promise<KitMaterial> {
  const phrase = words ?? (await generatePhrase());
  const salt = generatePhraseVerifierSalt();
  const phraseSalt = uint8ToBase64(salt);
  const recoveryPhraseHash = await derivePhraseVerifier(phrase, salt);
  const rawRootKey = await deriveRawRootKey(phrase, salt);
  const encryptedKeyBundle = await buildKeyBundle(
    rawMasterKey,
    rawRootKey,
    phraseSalt,
  );
  return {
    phrase,
    phraseSalt,
    recoveryPhraseHash,
    encryptedKeyBundle,
    rawRootKey,
  };
}

/** ML-KEM encryption keypair + ML-DSA identity, secrets wrapped under the MasterKey. */
export async function createPublicKeyMaterial(
  masterKey: CryptoKey,
): Promise<{ publicKeys: PublicKeyMaterial; identitySecretKey: string }> {
  const { publicKey, secretKey } = generateRecipientKeyPair();
  const publicKeyB64 = serializePublicKey(publicKey);
  const encryptedAsymmetricSecretKey = await wrapSecretUnderMasterKey(
    serializeSecretKey(secretKey),
    masterKey,
  );
  secretKey.fill(0);

  const identity = generateIdentityKeyPair();
  const encryptedIdentitySecretKey = await wrapSecretUnderMasterKey(
    identity.secretKey,
    masterKey,
  );
  // Bind the ML-KEM key to the identity (TOFU): contacts verify this.
  const publicKeySignature = signBytes(
    identity.secretKey,
    parsePublicKey(publicKeyB64),
  );

  return {
    publicKeys: {
      publicKey: publicKeyB64,
      encryptedAsymmetricSecretKey,
      identityPublicKey: identity.publicKey,
      encryptedIdentitySecretKey,
      publicKeySignature,
    },
    identitySecretKey: identity.secretKey,
  };
}

/** Everything M01-4 "Create my vault" needs, generated on the device. */
export async function createVaultMaterial(
  words?: string[],
): Promise<VaultMaterial> {
  const masterKey = await generateMasterKey();
  const rawMasterKey = await exportRawKey(masterKey);
  const kit = await createKitMaterial(rawMasterKey, words);
  const { publicKeys, identitySecretKey } =
    await createPublicKeyMaterial(masterKey);
  return { ...kit, publicKeys, rawMasterKey, identitySecretKey };
}

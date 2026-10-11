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

export interface VaultMaterial {
  /** Shown once as the recovery kit; never sent anywhere. */
  phrase: string[];
  phraseSalt: string;
  /** `onboarding.storeRecoveryPhraseHash.recoveryPhraseHash`. */
  recoveryPhraseHash: string;
  /** `onboarding.storeKeyBundle.encryptedKeyBundle`. */
  encryptedKeyBundle: string;
  publicKeys: PublicKeyMaterial;
  /** Raw 32-byte MasterKey, wrapped for this device right after. */
  rawMasterKey: Uint8Array;
  /** ML-DSA identity secret (base64) for pairing signatures this session. */
  identitySecretKey: string;
}

function fresh(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export function importMasterKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    fresh(raw),
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

/** AES-GCM wrap a base64 secret under the MasterKey → `{ciphertext, iv}` JSON. */
export async function wrapSecretUnderMasterKey(
  secretB64: string,
  masterKey: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    masterKey,
    fresh(new TextEncoder().encode(secretB64)),
  );
  return JSON.stringify({
    ciphertext: uint8ToBase64(new Uint8Array(ciphertext)),
    iv: uint8ToBase64(iv),
  });
}

/** Inverse of {@link wrapSecretUnderMasterKey}: returns the base64 secret. */
export async function unwrapSecretUnderMasterKey(
  wrapped: string,
  masterKey: CryptoKey,
): Promise<string> {
  const { ciphertext, iv } = JSON.parse(wrapped) as {
    ciphertext: string;
    iv: string;
  };
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToUint8(iv) },
    masterKey,
    base64ToUint8(ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

/** Wrap the raw MasterKey under the RootKey into a v2 key bundle (JSON). */
export async function buildKeyBundle(
  rawMasterKey: Uint8Array,
  rootKey: CryptoKey,
  phraseSalt: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    rootKey,
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

/**
 * Open a v2 key bundle with the 24 words (recovery kit entry on a new
 * phone). A wrong phrase fails the AES-GCM tag check and throws.
 */
export async function openKeyBundle(
  encryptedKeyBundle: string,
  phrase: string | string[],
): Promise<Uint8Array> {
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
  const rootKey = await deriveRootKey(phrase, base64ToUint8(bundle.phraseSalt));
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToUint8(bundle.iv) },
    rootKey,
    base64ToUint8(bundle.encryptedMasterKey),
  );
  return new Uint8Array(raw);
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
export async function createVaultMaterial(): Promise<VaultMaterial> {
  const phrase = await generatePhrase();
  const salt = generatePhraseVerifierSalt();
  const phraseSalt = uint8ToBase64(salt);
  const recoveryPhraseHash = await derivePhraseVerifier(phrase, salt);
  const rootKey = await deriveRootKey(phrase, salt);

  const masterKey = await generateMasterKey();
  const rawMasterKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", masterKey),
  );
  const encryptedKeyBundle = await buildKeyBundle(
    rawMasterKey,
    rootKey,
    phraseSalt,
  );
  const { publicKeys, identitySecretKey } =
    await createPublicKeyMaterial(masterKey);

  return {
    phrase,
    phraseSalt,
    recoveryPhraseHash,
    encryptedKeyBundle,
    publicKeys,
    rawMasterKey,
    identitySecretKey,
  };
}

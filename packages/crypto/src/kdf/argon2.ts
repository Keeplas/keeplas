import { argon2id } from "hash-wasm";

// OWASP 2024 baseline for interactive logins (≈ 1s on a modern phone).
// memorySize is in KiB, so 19456 KiB == 19 MiB.
const ARGON2_PARAMS = {
  parallelism: 1,
  iterations: 2,
  memorySize: 19456,
  hashLength: 32,
} as const;

export const ARGON2_OWASP_PARAMS = ARGON2_PARAMS;

const MIN_SALT_BYTES = 16;

function normalizePhrase(phraseOrWords: string | string[]): string {
  const words = Array.isArray(phraseOrWords)
    ? phraseOrWords
    : phraseOrWords.split(/\s+/);
  const normalized = words
    .map((w) => w.toLowerCase().trim().normalize("NFKD"))
    .filter(Boolean);
  if (!normalized.length) {
    throw new Error("phrase must not be empty");
  }
  return normalized.join(" ");
}

async function importAesKey(
  raw: Uint8Array,
  extractable: boolean
): Promise<CryptoKey> {
  // Copy into a fresh ArrayBuffer-backed buffer so importKey's strict
  // BufferSource overload accepts it under noUncheckedIndexedAccess.
  const buf = new Uint8Array(raw.byteLength);
  buf.set(raw);
  return crypto.subtle.importKey(
    "raw",
    buf,
    { name: "AES-GCM", length: 256 },
    extractable,
    ["encrypt", "decrypt"]
  );
}

async function runArgon2id(
  password: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  const result = await argon2id({
    password,
    salt,
    ...ARGON2_PARAMS,
    outputType: "binary",
  });
  return result;
}

/**
 * Derive the user's RootKey from their 24-word recovery phrase.
 *
 * The RootKey wraps the MasterKey which in turn encrypts all vault content.
 * The phrase never leaves the client; the server stores only `userSalt`.
 *
 * `extractable` defaults to false. Pass true only when the raw bytes are
 * needed for re-wrapping (e.g. during device-unlock enrollment).
 */
export async function deriveRootKey(
  phrase: string | string[],
  userSalt: Uint8Array,
  options: { extractable?: boolean } = {}
): Promise<CryptoKey> {
  if (userSalt.length < MIN_SALT_BYTES) {
    throw new Error(`userSalt must be at least ${MIN_SALT_BYTES} bytes`);
  }
  const password = normalizePhrase(phrase);
  const raw = await runArgon2id(password, userSalt);
  return importAesKey(raw, options.extractable ?? false);
}

/**
 * Derive an AES-GCM wrap key from a device-local secret (PIN, passphrase).
 *
 * Used by the device-unlock module to wrap the RootKey in IndexedDB. The
 * `deviceSalt` is generated fresh per enrollment and stored alongside the
 * wrapped RootKey — never sent to the server.
 */
export async function deriveDeviceWrapKey(
  secret: string,
  deviceSalt: Uint8Array
): Promise<CryptoKey> {
  if (deviceSalt.length < MIN_SALT_BYTES) {
    throw new Error(`deviceSalt must be at least ${MIN_SALT_BYTES} bytes`);
  }
  if (!secret) {
    throw new Error("secret must not be empty");
  }
  const raw = await runArgon2id(secret, deviceSalt);
  return importAesKey(raw, false);
}

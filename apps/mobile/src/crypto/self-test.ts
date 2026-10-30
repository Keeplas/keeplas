import { argon2idRaw } from "@keeplas/crypto/kdf";
import { base64ToUint8, uint8ToHex } from "@keeplas/crypto/encoding";
import {
  generateRecipientKeyPair,
  getMlKemImplementation,
  nobleMlKemImplementation,
  serializePublicKey,
  unwrapBytes,
  wrapBytes,
} from "@keeplas/crypto/kem";
import {
  generateIdentityKeyPair,
  getMlDsaImplementation,
  nobleMlDsaImplementation,
  signBytes,
  verifyBytes,
} from "@keeplas/crypto/sig";

import { createVaultMaterial, openKeyBundle } from "./vault-keys";

/** Shared vector from packages/crypto/__tests__/argon2.test.ts. */
export const ARGON2_VECTOR = {
  password: "keeplas test vector",
  salt: new Uint8Array(16).map((_, i) => i),
  digest: "fd1a6d4b92128de61f22d991c6ad7de24ee800c5ae9ef7269bfbe84285ec50ea",
};

export interface SelfTestResult {
  name: string;
  ok: boolean;
  detail?: string;
  ms: number;
}

const CHECKS: { name: string; run: () => Promise<void> }[] = [
  {
    name: "Argon2id shared vector",
    run: async () => {
      const hex = uint8ToHex(
        await argon2idRaw(ARGON2_VECTOR.password, ARGON2_VECTOR.salt),
      );
      if (hex !== ARGON2_VECTOR.digest) throw new Error(hex);
    },
  },
  {
    name: "ML-KEM-768 + AES-GCM (with AAD)",
    run: async () => {
      const { publicKey, secretKey } = generateRecipientKeyPair();
      const aad = new TextEncoder().encode("session|origin");
      const sealed = await wrapBytes(
        new Uint8Array([1, 2, 3]),
        serializePublicKey(publicKey),
        aad,
      );
      const opened = await unwrapBytes(sealed, secretKey, aad);
      if (opened.join() !== "1,2,3") throw new Error("round trip");
    },
  },
  {
    name: "ML-DSA-65 sign / verify",
    run: async () => {
      const identity = generateIdentityKeyPair();
      const message = new TextEncoder().encode("keeplas");
      if (
        !verifyBytes(
          identity.publicKey,
          message,
          signBytes(identity.secretKey, message),
        )
      ) {
        throw new Error("signature");
      }
    },
  },
  {
    // Byte-for-byte compat between the installed ML-KEM engine (native
    // OpenSSL on device, noble on Node) and the noble reference: shared
    // secrets must match in both directions.
    name: "ML-KEM-768 engine ⇄ noble cross-compat",
    run: async () => {
      const engine = getMlKemImplementation();
      const noble = nobleMlKemImplementation;
      const { publicKey, secretKey } = generateRecipientKeyPair();
      const a = await engine.encapsulate(publicKey);
      const aSs = await noble.decapsulate(a.cipherText, secretKey);
      if (uint8ToHex(aSs) !== uint8ToHex(a.sharedSecret))
        throw new Error("engine encapsulate → noble decapsulate");
      const b = await noble.encapsulate(publicKey);
      const bSs = await engine.decapsulate(b.cipherText, secretKey);
      if (uint8ToHex(bSs) !== uint8ToHex(b.sharedSecret))
        throw new Error("noble encapsulate → engine decapsulate");
    },
  },
  {
    // Same cross-check for ML-DSA-65: each side must verify the other's
    // signature over the same message and keypair.
    name: "ML-DSA-65 engine ⇄ noble cross-compat",
    run: async () => {
      const engine = getMlDsaImplementation();
      const noble = nobleMlDsaImplementation;
      const identity = generateIdentityKeyPair();
      const publicKey = base64ToUint8(identity.publicKey);
      const secretKey = base64ToUint8(identity.secretKey);
      const message = new TextEncoder().encode("keeplas cross vector");
      const engineSig = await engine.sign(message, secretKey);
      if (!(await noble.verify(engineSig, message, publicKey)))
        throw new Error("engine sign → noble verify");
      const nobleSig = await noble.sign(message, secretKey);
      if (!(await engine.verify(nobleSig, message, publicKey)))
        throw new Error("noble sign → engine verify");
      if (await engine.verify(nobleSig, message.slice(0, -1), publicKey))
        throw new Error("engine verified a tampered message");
    },
  },
  {
    name: "Vault creation + 24-word reopen",
    run: async () => {
      const material = await createVaultMaterial("self-test");
      const { masterKey } = await openKeyBundle(
        material.encryptedKeyBundle,
        material.phrase,
      );
      if (uint8ToHex(masterKey) !== uint8ToHex(material.rawMasterKey))
        throw new Error("bundle");
    },
  },
];

/**
 * Cross-platform crypto checks: the same vectors and round trips must pass
 * on Node (jest) and on Hermes with the native engines (dev screen).
 */
export async function runSelfTest(): Promise<SelfTestResult[]> {
  const results: SelfTestResult[] = [];
  for (const check of CHECKS) {
    const start = Date.now();
    try {
      await check.run();
      results.push({ name: check.name, ok: true, ms: Date.now() - start });
    } catch (error) {
      results.push({
        name: check.name,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
        ms: Date.now() - start,
      });
    }
  }
  return results;
}

/**
 * @jest-environment node
 */
import { argon2id } from "hash-wasm";
import {
  ARGON2_OWASP_PARAMS,
  setArgon2idImplementation,
} from "@keeplas/crypto/kdf";
import { derivePhraseVerifier } from "@keeplas/crypto/recovery";
import { parsePublicKey } from "@keeplas/crypto/kem";
import { verifyBytes } from "@keeplas/crypto/sig";
import { base64ToUint8, uint8ToHex } from "@keeplas/crypto/encoding";

import { createArgon2idEngine, type Argon2Fn } from "../argon2";
import { runSelfTest } from "../self-test";
import {
  createVaultMaterial,
  importMasterKey,
  openKeyBundle,
  unwrapSecretUnderMasterKey,
} from "../vault-keys";

/**
 * A Node-style argon2 backed by hash-wasm, so the adapter that maps
 * react-native-quick-crypto's parameters is checked against a real Argon2id.
 */
const nodeStyleArgon2: Argon2Fn = (_algorithm, params, callback) => {
  argon2id({
    password: params.message,
    salt: params.nonce,
    iterations: params.passes,
    memorySize: params.memory,
    parallelism: params.parallelism,
    hashLength: params.tagLength,
    outputType: "binary",
  }).then(
    (out) => callback(null, out),
    (err: Error) => callback(err, new Uint8Array()),
  );
};

beforeAll(() => {
  setArgon2idImplementation(createArgon2idEngine(nodeStyleArgon2));
});

jest.setTimeout(60_000);

describe("native Argon2id adapter", () => {
  it("passes the OWASP params through", async () => {
    const seen: unknown[] = [];
    const engine = createArgon2idEngine((algorithm, params, callback) => {
      seen.push({ algorithm, ...params });
      callback(null, new Uint8Array(32));
    });
    await engine({
      password: "p",
      salt: new Uint8Array(16),
      ...ARGON2_OWASP_PARAMS,
    });
    expect(seen).toEqual([
      {
        algorithm: "argon2id",
        message: "p",
        nonce: new Uint8Array(16),
        passes: 2,
        memory: 19456,
        parallelism: 1,
        tagLength: 32,
      },
    ]);
  });

  it("propagates engine errors", async () => {
    const engine = createArgon2idEngine((_a, _p, callback) =>
      callback(new Error("boom"), new Uint8Array()),
    );
    await expect(
      engine({
        password: "p",
        salt: new Uint8Array(16),
        ...ARGON2_OWASP_PARAMS,
      }),
    ).rejects.toThrow("boom");
  });
});

describe("self-test (same checks as the on-device dev screen)", () => {
  it("passes every check, including the shared Argon2id vector", async () => {
    const results = await runSelfTest();
    expect(results.filter((r) => !r.ok)).toEqual([]);
  });
});

describe("vault material matches the web onboarding format", () => {
  it("produces a v2 bundle, a salted verifier and signed public keys", async () => {
    const m = await createVaultMaterial();
    expect(m.phrase).toHaveLength(24);
    const bundle = JSON.parse(m.encryptedKeyBundle);
    expect(Object.keys(bundle).sort()).toEqual([
      "encryptedMasterKey",
      "iv",
      "phraseSalt",
      "version",
    ]);
    expect(bundle.version).toBe(2);
    expect(bundle.phraseSalt).toBe(m.phraseSalt);
    expect(m.recoveryPhraseHash).toBe(
      await derivePhraseVerifier(m.phrase, base64ToUint8(m.phraseSalt)),
    );

    const { publicKeys } = m;
    expect(
      verifyBytes(
        publicKeys.identityPublicKey,
        parsePublicKey(publicKeys.publicKey),
        publicKeys.publicKeySignature,
      ),
    ).toBe(true);

    const masterKey = await importMasterKey(m.rawMasterKey);
    const identitySecret = await unwrapSecretUnderMasterKey(
      publicKeys.encryptedIdentitySecretKey,
      masterKey,
    );
    expect(base64ToUint8(identitySecret)).toHaveLength(4032);
    expect(
      Object.keys(JSON.parse(publicKeys.encryptedAsymmetricSecretKey)).sort(),
    ).toEqual(["ciphertext", "iv"]);

    const reopened = await openKeyBundle(
      m.encryptedKeyBundle,
      m.phrase.join(" "),
    );
    expect(uint8ToHex(reopened.masterKey)).toBe(uint8ToHex(m.rawMasterKey));
    expect(uint8ToHex(reopened.rootKey)).toBe(uint8ToHex(m.rawRootKey));
  });

  it("refuses a wrong phrase and legacy v1 bundles", async () => {
    const m = await createVaultMaterial();
    const wrong = [...m.phrase].reverse();
    await expect(openKeyBundle(m.encryptedKeyBundle, wrong)).rejects.toThrow();
    await expect(
      openKeyBundle(
        JSON.stringify({ wrappingKey: "x", iv: "y", encryptedMasterKey: "z" }),
        m.phrase,
      ),
    ).rejects.toThrow("Unsupported");
  });
});

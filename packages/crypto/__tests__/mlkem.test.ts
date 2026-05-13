import { describe, it, expect } from "vitest";
import {
  ML_KEM_PARAMS,
  generateRecipientKeyPair,
  serializePublicKey,
  parsePublicKey,
  serializeSecretKey,
  parseSecretKey,
  wrapDek,
  unwrapDek,
  wrapBytes,
  unwrapBytes,
} from "../src/kem";

async function generateTestDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

async function exportRaw(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}

describe("ML-KEM-768 (post-quantum)", () => {
  it("declares the expected FIPS 203 ML-KEM-768 parameters", () => {
    expect(ML_KEM_PARAMS.algorithm).toBe("ML-KEM-768");
    expect(ML_KEM_PARAMS.fips).toBe("FIPS 203");
    expect(ML_KEM_PARAMS.publicKeyBytes).toBe(1184);
    expect(ML_KEM_PARAMS.secretKeyBytes).toBe(2400);
    expect(ML_KEM_PARAMS.ciphertextBytes).toBe(1088);
    expect(ML_KEM_PARAMS.sharedSecretBytes).toBe(32);
  });

  describe("keypair generation", () => {
    it("produces public and secret keys of the correct lengths", () => {
      const { publicKey, secretKey } = generateRecipientKeyPair();
      expect(publicKey.length).toBe(1184);
      expect(secretKey.length).toBe(2400);
    });

    it("produces a different keypair every call", () => {
      const a = generateRecipientKeyPair();
      const b = generateRecipientKeyPair();
      expect(a.publicKey).not.toEqual(b.publicKey);
      expect(a.secretKey).not.toEqual(b.secretKey);
    });
  });

  describe("(de)serialization", () => {
    it("round-trips public and secret keys through base64", () => {
      const { publicKey, secretKey } = generateRecipientKeyPair();
      const pkB64 = serializePublicKey(publicKey);
      const skB64 = serializeSecretKey(secretKey);
      expect(parsePublicKey(pkB64)).toEqual(publicKey);
      expect(parseSecretKey(skB64)).toEqual(secretKey);
    });

    it("rejects malformed public keys", () => {
      expect(() => parsePublicKey("AAAA")).toThrow(/1184 bytes/);
    });

    it("rejects malformed secret keys", () => {
      expect(() => parseSecretKey("AAAA")).toThrow(/2400 bytes/);
    });
  });

  describe("DEK wrap / unwrap", () => {
    it("round-trips a DEK through wrap and unwrap", async () => {
      const { publicKey, secretKey } = generateRecipientKeyPair();
      const dek = await generateTestDek();
      const envelope = await wrapDek(dek, serializePublicKey(publicKey));
      const restored = await unwrapDek(envelope, secretKey);
      expect(await exportRaw(restored)).toEqual(await exportRaw(dek));
    });

    it("returns an extractable DEK so the owner can re-wrap it", async () => {
      const { publicKey, secretKey } = generateRecipientKeyPair();
      const dek = await generateTestDek();
      const envelope = await wrapDek(dek, serializePublicKey(publicKey));
      const restored = await unwrapDek(envelope, secretKey);
      // Should not throw — extractable: true at import time.
      const raw = await crypto.subtle.exportKey("raw", restored);
      expect(raw.byteLength).toBe(32);
    });

    it("encapsulation is randomized — same DEK and pubkey yield different envelopes", async () => {
      const { publicKey, secretKey } = generateRecipientKeyPair();
      const dek = await generateTestDek();
      const a = await wrapDek(dek, serializePublicKey(publicKey));
      const b = await wrapDek(dek, serializePublicKey(publicKey));
      expect(a).not.toBe(b);
      const aJson = JSON.parse(a);
      const bJson = JSON.parse(b);
      expect(aJson.kem).not.toEqual(bJson.kem);
      expect(aJson.iv).not.toEqual(bJson.iv);
      // Both envelopes still decrypt to the same DEK
      const decA = await unwrapDek(a, secretKey);
      const decB = await unwrapDek(b, secretKey);
      expect(await exportRaw(decA)).toEqual(await exportRaw(decB));
    });

    it("fails to unwrap with the wrong secret key", async () => {
      const alice = generateRecipientKeyPair();
      const eve = generateRecipientKeyPair();
      const dek = await generateTestDek();
      const envelope = await wrapDek(dek, serializePublicKey(alice.publicKey));
      await expect(unwrapDek(envelope, eve.secretKey)).rejects.toThrow();
    });

    it("rejects a tampered envelope (corrupted ciphertext)", async () => {
      const { publicKey, secretKey } = generateRecipientKeyPair();
      const dek = await generateTestDek();
      const envelopeStr = await wrapDek(dek, serializePublicKey(publicKey));
      const envelope = JSON.parse(envelopeStr);
      // Flip a byte in the AES ciphertext
      const ctBytes = Uint8Array.from(atob(envelope.ct), (c) =>
        c.charCodeAt(0),
      );
      ctBytes[0] ^= 0xff;
      envelope.ct = btoa(String.fromCharCode(...ctBytes));
      await expect(
        unwrapDek(JSON.stringify(envelope), secretKey),
      ).rejects.toThrow();
    });

    it("rejects malformed envelopes (not JSON)", async () => {
      const { secretKey } = generateRecipientKeyPair();
      await expect(unwrapDek("not-json", secretKey)).rejects.toThrow(
        /Invalid envelope/,
      );
    });

    it("rejects envelopes with a wrong algorithm marker", async () => {
      const { secretKey } = generateRecipientKeyPair();
      const bogus = JSON.stringify({
        v: 1,
        alg: "rsa-2048",
        kem: "AAAA",
        iv: "AAAA",
        ct: "AAAA",
      });
      await expect(unwrapDek(bogus, secretKey)).rejects.toThrow(
        /unsupported version/,
      );
    });
  });

  describe("raw bytes wrap / unwrap (for shards)", () => {
    it("round-trips arbitrary bytes", async () => {
      const { publicKey, secretKey } = generateRecipientKeyPair();
      const payload = crypto.getRandomValues(new Uint8Array(64));
      const envelope = await wrapBytes(payload, serializePublicKey(publicKey));
      const restored = await unwrapBytes(envelope, secretKey);
      expect(restored).toEqual(payload);
    });
  });
});

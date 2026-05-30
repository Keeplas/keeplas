import { describe, it, expect } from "vitest";
import {
  ML_DSA_PARAMS,
  generateIdentityKeyPair,
  signBytes,
  verifyBytes,
  identityKeyFingerprint,
} from "../src/sig";
import { base64ToUint8 } from "../src/encoding";

const message = new TextEncoder().encode("bind this ML-KEM public key");

describe("ML-DSA-65 (post-quantum signatures)", () => {
  it("declares the expected FIPS 204 ML-DSA-65 parameters", () => {
    expect(ML_DSA_PARAMS.algorithm).toBe("ML-DSA-65");
    expect(ML_DSA_PARAMS.fips).toBe("FIPS 204");
    expect(ML_DSA_PARAMS.publicKeyBytes).toBe(1952);
    expect(ML_DSA_PARAMS.secretKeyBytes).toBe(4032);
    expect(ML_DSA_PARAMS.signatureBytes).toBe(3309);
  });

  describe("keypair generation", () => {
    it("produces base64 keys decoding to the correct lengths", () => {
      const { publicKey, secretKey } = generateIdentityKeyPair();
      expect(base64ToUint8(publicKey).length).toBe(
        ML_DSA_PARAMS.publicKeyBytes,
      );
      expect(base64ToUint8(secretKey).length).toBe(
        ML_DSA_PARAMS.secretKeyBytes,
      );
    });

    it("produces distinct keypairs across calls", () => {
      const a = generateIdentityKeyPair();
      const b = generateIdentityKeyPair();
      expect(a.publicKey).not.toBe(b.publicKey);
      expect(a.secretKey).not.toBe(b.secretKey);
    });
  });

  describe("sign / verify roundtrip", () => {
    it("verifies a signature made with the matching secret key", () => {
      const { publicKey, secretKey } = generateIdentityKeyPair();
      const sig = signBytes(secretKey, message);
      expect(base64ToUint8(sig).length).toBe(ML_DSA_PARAMS.signatureBytes);
      expect(verifyBytes(publicKey, message, sig)).toBe(true);
    });

    it("rejects a signature verified against a different public key", () => {
      const signer = generateIdentityKeyPair();
      const other = generateIdentityKeyPair();
      const sig = signBytes(signer.secretKey, message);
      expect(verifyBytes(other.publicKey, message, sig)).toBe(false);
    });

    it("rejects when the message was tampered with", () => {
      const { publicKey, secretKey } = generateIdentityKeyPair();
      const sig = signBytes(secretKey, message);
      const tampered = new TextEncoder().encode(
        "bind this ML-KEM public key!",
      );
      expect(verifyBytes(publicKey, tampered, sig)).toBe(false);
    });

    it("rejects a tampered signature", () => {
      const { publicKey, secretKey } = generateIdentityKeyPair();
      const sig = base64ToUint8(signBytes(secretKey, message));
      sig[0] ^= 0xff;
      const tamperedB64 = btoa(String.fromCharCode(...sig));
      expect(verifyBytes(publicKey, message, tamperedB64)).toBe(false);
    });

    it("returns false (not throw) on malformed inputs", () => {
      const { publicKey, secretKey } = generateIdentityKeyPair();
      const sig = signBytes(secretKey, message);
      expect(verifyBytes("not-a-key", message, sig)).toBe(false);
      expect(verifyBytes(publicKey, message, "not-a-sig")).toBe(false);
    });

    it("throws when signing with a wrong-length secret key", () => {
      expect(() => signBytes(btoa("short"), message)).toThrow();
    });
  });

  describe("identity key fingerprint", () => {
    it("is deterministic for a given public key", async () => {
      const { publicKey } = generateIdentityKeyPair();
      const f1 = await identityKeyFingerprint(publicKey);
      const f2 = await identityKeyFingerprint(publicKey);
      expect(f1).toBe(f2);
      // SHA-256 hex = 64 chars.
      expect(f1).toMatch(/^[0-9a-f]{64}$/);
    });

    it("differs across distinct public keys", async () => {
      const a = generateIdentityKeyPair();
      const b = generateIdentityKeyPair();
      expect(await identityKeyFingerprint(a.publicKey)).not.toBe(
        await identityKeyFingerprint(b.publicKey),
      );
    });

    it("throws on a wrong-length public key", async () => {
      await expect(identityKeyFingerprint(btoa("short"))).rejects.toThrow();
    });
  });
});

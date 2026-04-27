import { describe, it, expect } from "vitest";
import {
  deriveRootKey,
  deriveDeviceWrapKey,
  ARGON2_OWASP_PARAMS,
} from "../src/kdf";

const TEST_PHRASE_24 = [
  "abandon", "ability", "able", "about", "above", "absent",
  "absorb", "abstract", "absurd", "abuse", "access", "accident",
  "account", "accuse", "achieve", "acid", "acoustic", "acquire",
  "across", "act", "action", "actor", "actress", "actual",
];

const TEST_PHRASE_24_ALT = [
  "zoo", "zone", "zero", "yellow", "year", "wrong",
  "abandon", "ability", "able", "about", "above", "absent",
  "absorb", "abstract", "absurd", "abuse", "access", "accident",
  "account", "accuse", "achieve", "acid", "acoustic", "acquire",
];

function fixedSalt(byte: number = 0x42): Uint8Array {
  return new Uint8Array(16).fill(byte);
}

async function exportRaw(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}

describe("KDF Argon2id", () => {
  it("uses OWASP 2024 params", () => {
    expect(ARGON2_OWASP_PARAMS.parallelism).toBe(1);
    expect(ARGON2_OWASP_PARAMS.iterations).toBe(2);
    expect(ARGON2_OWASP_PARAMS.memorySize).toBe(19456);
    expect(ARGON2_OWASP_PARAMS.hashLength).toBe(32);
  });

  describe("deriveRootKey", () => {
    it("returns the same key for the same (phrase, salt)", async () => {
      const salt = fixedSalt();
      const a = await deriveRootKey(TEST_PHRASE_24, salt, { extractable: true });
      const b = await deriveRootKey(TEST_PHRASE_24, salt, { extractable: true });
      expect(await exportRaw(a)).toEqual(await exportRaw(b));
    });

    it("returns a different key when the salt changes", async () => {
      const a = await deriveRootKey(TEST_PHRASE_24, fixedSalt(0x11), {
        extractable: true,
      });
      const b = await deriveRootKey(TEST_PHRASE_24, fixedSalt(0x22), {
        extractable: true,
      });
      expect(await exportRaw(a)).not.toEqual(await exportRaw(b));
    });

    it("returns a different key when the phrase changes", async () => {
      const salt = fixedSalt();
      const a = await deriveRootKey(TEST_PHRASE_24, salt, { extractable: true });
      const b = await deriveRootKey(TEST_PHRASE_24_ALT, salt, {
        extractable: true,
      });
      expect(await exportRaw(a)).not.toEqual(await exportRaw(b));
    });

    it("normalizes case and accepts string or array input", async () => {
      const salt = fixedSalt();
      const upper = TEST_PHRASE_24.map((w) => w.toUpperCase());
      const joined = TEST_PHRASE_24.join(" ");
      const fromArray = await deriveRootKey(TEST_PHRASE_24, salt, {
        extractable: true,
      });
      const fromUpper = await deriveRootKey(upper, salt, { extractable: true });
      const fromString = await deriveRootKey(joined, salt, { extractable: true });
      const raw = await exportRaw(fromArray);
      expect(await exportRaw(fromUpper)).toEqual(raw);
      expect(await exportRaw(fromString)).toEqual(raw);
    });

    it("rejects salts shorter than 16 bytes", async () => {
      await expect(
        deriveRootKey(TEST_PHRASE_24, new Uint8Array(8))
      ).rejects.toThrow(/salt/i);
    });

    it("rejects empty phrases", async () => {
      await expect(deriveRootKey([], fixedSalt())).rejects.toThrow(/empty/);
      await expect(deriveRootKey("   ", fixedSalt())).rejects.toThrow(/empty/);
    });

    it("produces a key that can encrypt and decrypt with AES-GCM", async () => {
      const key = await deriveRootKey(TEST_PHRASE_24, fixedSalt());
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plaintext = new TextEncoder().encode("hello vault");
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        plaintext
      );
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext
      );
      expect(new TextDecoder().decode(decrypted)).toBe("hello vault");
    });
  });

  describe("deriveDeviceWrapKey", () => {
    it("is deterministic for same (secret, salt)", async () => {
      const salt = fixedSalt();
      const a = await deriveDeviceWrapKey("123456", salt);
      const b = await deriveDeviceWrapKey("123456", salt);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        a,
        new TextEncoder().encode("ping")
      );
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, b, ct);
      expect(new TextDecoder().decode(pt)).toBe("ping");
    });

    it("rejects empty secrets", async () => {
      await expect(
        deriveDeviceWrapKey("", fixedSalt())
      ).rejects.toThrow(/empty/);
    });

    it("rejects salts shorter than 16 bytes", async () => {
      await expect(
        deriveDeviceWrapKey("123456", new Uint8Array(4))
      ).rejects.toThrow(/salt/i);
    });
  });
});

import { describe, it, expect } from "vitest";
import {
  generatePhrase,
  entropyToPhrase,
  phraseToKey,
  phraseToHash,
} from "../src/recovery";
import { WORDLIST } from "../src/recovery/wordlist";

describe("BIP-39 Recovery Phrase", () => {
  describe("wordlist", () => {
    it("has exactly 2048 words", () => {
      expect(WORDLIST.length).toBe(2048);
    });

    it("has no duplicates", () => {
      const unique = new Set(WORDLIST);
      expect(unique.size).toBe(2048);
    });

    it("starts with 'abandon' and ends with 'zoo'", () => {
      expect(WORDLIST[0]).toBe("abandon");
      expect(WORDLIST[2047]).toBe("zoo");
    });
  });

  describe("generatePhrase", () => {
    it("generates 24 words", async () => {
      const words = await generatePhrase();
      expect(words).toHaveLength(24);
    });

    it("all words are from the BIP-39 wordlist", async () => {
      const words = await generatePhrase();
      const wordSet = new Set(WORDLIST);
      for (const word of words) {
        expect(wordSet.has(word)).toBe(true);
      }
    });

    it("generates different phrases each time", async () => {
      const phrase1 = await generatePhrase();
      const phrase2 = await generatePhrase();
      expect(phrase1).not.toEqual(phrase2);
    });
  });

  describe("entropyToPhrase (deterministic)", () => {
    it("produces deterministic output for same entropy", async () => {
      const entropy = new Uint8Array(32);
      entropy.fill(0);

      const phrase1 = await entropyToPhrase(entropy);
      const phrase2 = await entropyToPhrase(entropy);

      expect(phrase1).toEqual(phrase2);
    });

    it("produces 24 words for 32 bytes of entropy", async () => {
      const entropy = new Uint8Array(32);
      crypto.getRandomValues(entropy);

      const words = await entropyToPhrase(entropy);
      expect(words).toHaveLength(24);
    });

    it("rejects entropy that is not 32 bytes", async () => {
      await expect(entropyToPhrase(new Uint8Array(16))).rejects.toThrow(
        "32 bytes"
      );
      await expect(entropyToPhrase(new Uint8Array(64))).rejects.toThrow(
        "32 bytes"
      );
    });

    it("different entropy produces different phrases", async () => {
      const entropy1 = new Uint8Array(32).fill(0);
      const entropy2 = new Uint8Array(32).fill(1);

      const phrase1 = await entropyToPhrase(entropy1);
      const phrase2 = await entropyToPhrase(entropy2);

      expect(phrase1).not.toEqual(phrase2);
    });
  });

  describe("phraseToKey", () => {
    it("derives a 256-bit AES-GCM key", async () => {
      const words = await generatePhrase();
      const key = await phraseToKey(words);

      expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
      expect(key.extractable).toBe(true);
      expect(key.usages).toContain("encrypt");
      expect(key.usages).toContain("decrypt");
    });

    it("same phrase always produces the same key", async () => {
      const entropy = new Uint8Array(32).fill(42);
      const words = await entropyToPhrase(entropy);

      const key1 = await phraseToKey(words);
      const key2 = await phraseToKey(words);

      const raw1 = new Uint8Array(await crypto.subtle.exportKey("raw", key1));
      const raw2 = new Uint8Array(await crypto.subtle.exportKey("raw", key2));

      expect(raw1).toEqual(raw2);
    });

    it("different phrases produce different keys", async () => {
      const words1 = await entropyToPhrase(new Uint8Array(32).fill(0));
      const words2 = await entropyToPhrase(new Uint8Array(32).fill(1));

      const key1 = await phraseToKey(words1);
      const key2 = await phraseToKey(words2);

      const raw1 = new Uint8Array(await crypto.subtle.exportKey("raw", key1));
      const raw2 = new Uint8Array(await crypto.subtle.exportKey("raw", key2));

      expect(raw1).not.toEqual(raw2);
    });

    it("is case-insensitive", async () => {
      const words = await generatePhrase();
      const upper = words.map((w) => w.toUpperCase());

      const key1 = await phraseToKey(words);
      const key2 = await phraseToKey(upper);

      const raw1 = new Uint8Array(await crypto.subtle.exportKey("raw", key1));
      const raw2 = new Uint8Array(await crypto.subtle.exportKey("raw", key2));

      expect(raw1).toEqual(raw2);
    });

    it("rejects phrases that are not 24 words", async () => {
      await expect(phraseToKey(["abandon"])).rejects.toThrow("24 words");
      await expect(phraseToKey([])).rejects.toThrow("24 words");
    });
  });

  describe("phraseToHash", () => {
    it("returns a 64-character hex string (SHA-256)", async () => {
      const words = await generatePhrase();
      const hash = await phraseToHash(words);

      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("same phrase always produces the same hash", async () => {
      const entropy = new Uint8Array(32).fill(42);
      const words = await entropyToPhrase(entropy);

      const hash1 = await phraseToHash(words);
      const hash2 = await phraseToHash(words);

      expect(hash1).toBe(hash2);
    });

    it("different phrases produce different hashes", async () => {
      const words1 = await entropyToPhrase(new Uint8Array(32).fill(0));
      const words2 = await entropyToPhrase(new Uint8Array(32).fill(1));

      const hash1 = await phraseToHash(words1);
      const hash2 = await phraseToHash(words2);

      expect(hash1).not.toBe(hash2);
    });

    it("is case-insensitive", async () => {
      const words = await generatePhrase();
      const upper = words.map((w) => w.toUpperCase());

      const hash1 = await phraseToHash(words);
      const hash2 = await phraseToHash(upper);

      expect(hash1).toBe(hash2);
    });

    it("rejects phrases that are not 24 words", async () => {
      await expect(phraseToHash(["abandon"])).rejects.toThrow("24 words");
    });
  });

  describe("full roundtrip: phrase → key → encrypt → decrypt", () => {
    it("works end to end", async () => {
      const words = await generatePhrase();
      const key = await phraseToKey(words);

      // Import encrypt/decrypt
      const { encrypt, decrypt } = await import("../src/aes");

      const data = { vault: "my secrets", critical: true };
      const plaintext = new TextEncoder().encode(JSON.stringify(data));

      const { ciphertext, iv } = await encrypt(plaintext, key);
      const decrypted = await decrypt(ciphertext, key, iv);
      const result = JSON.parse(new TextDecoder().decode(decrypted));

      expect(result).toEqual(data);
    });
  });
});

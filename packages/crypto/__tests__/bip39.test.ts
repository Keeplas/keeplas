import { describe, it, expect } from "vitest";
import {
  generatePhrase,
  entropyToPhrase,
  derivePhraseVerifier,
  generatePhraseVerifierSalt,
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
        "32 bytes",
      );
      await expect(entropyToPhrase(new Uint8Array(64))).rejects.toThrow(
        "32 bytes",
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

  describe("derivePhraseVerifier", () => {
    it("returns a 64-character hex string (32-byte Argon2id digest)", async () => {
      const words = await generatePhrase();
      const salt = generatePhraseVerifierSalt();
      const verifier = await derivePhraseVerifier(words, salt);

      expect(verifier).toMatch(/^[0-9a-f]{64}$/);
    });

    it("same phrase + same salt always produces the same verifier", async () => {
      const entropy = new Uint8Array(32).fill(42);
      const words = await entropyToPhrase(entropy);
      const salt = new Uint8Array(16).fill(7);

      const v1 = await derivePhraseVerifier(words, salt);
      const v2 = await derivePhraseVerifier(words, salt);

      expect(v1).toBe(v2);
    });

    it("same phrase + different salt produces different verifiers", async () => {
      const entropy = new Uint8Array(32).fill(42);
      const words = await entropyToPhrase(entropy);

      const v1 = await derivePhraseVerifier(words, new Uint8Array(16).fill(1));
      const v2 = await derivePhraseVerifier(words, new Uint8Array(16).fill(2));

      expect(v1).not.toBe(v2);
    });

    it("different phrases + same salt produce different verifiers (wrong phrase rejected)", async () => {
      const salt = new Uint8Array(16).fill(9);
      const words1 = await entropyToPhrase(new Uint8Array(32).fill(0));
      const words2 = await entropyToPhrase(new Uint8Array(32).fill(1));

      const v1 = await derivePhraseVerifier(words1, salt);
      const v2 = await derivePhraseVerifier(words2, salt);

      expect(v1).not.toBe(v2);
    });

    it("is case-insensitive", async () => {
      const words = await generatePhrase();
      const upper = words.map((w) => w.toUpperCase());
      const salt = new Uint8Array(16).fill(3);

      const v1 = await derivePhraseVerifier(words, salt);
      const v2 = await derivePhraseVerifier(upper, salt);

      expect(v1).toBe(v2);
    });

    it("rejects phrases that are not 24 words", async () => {
      const salt = generatePhraseVerifierSalt();
      await expect(derivePhraseVerifier(["abandon"], salt)).rejects.toThrow(
        "24 words",
      );
    });

    it("rejects salts shorter than 16 bytes", async () => {
      const words = await generatePhrase();
      await expect(
        derivePhraseVerifier(words, new Uint8Array(8)),
      ).rejects.toThrow(/salt/i);
    });

    it("generatePhraseVerifierSalt returns 16 random bytes", () => {
      const a = generatePhraseVerifierSalt();
      const b = generatePhraseVerifierSalt();
      expect(a.length).toBe(16);
      expect(b.length).toBe(16);
      expect(a).not.toEqual(b);
    });
  });

});

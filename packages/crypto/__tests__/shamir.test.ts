import { describe, it, expect } from "vitest";
import { split, reconstruct } from "../src/shamir";

describe("Shamir Secret Sharing", () => {
  const secret32 = new Uint8Array(32);

  function getCombinations<T>(arr: T[], k: number): T[][] {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];
    const [first, ...rest] = arr;
    const withFirst = getCombinations(rest, k - 1).map((c) => [first, ...c]);
    const withoutFirst = getCombinations(rest, k);
    return [...withFirst, ...withoutFirst];
  }

  describe("split", () => {
    it("generates the correct number of shares", async () => {
      crypto.getRandomValues(secret32);
      const shares = await split(secret32, 5, 3);
      expect(shares).toHaveLength(5);
    });

    it("each share has correct length (1 + secretLen)", async () => {
      crypto.getRandomValues(secret32);
      const shares = await split(secret32, 5, 3);
      for (const share of shares) {
        expect(share.length).toBe(33); // 1 byte x-coord + 32 bytes data
      }
    });

    it("assigns unique x-coordinates 1..n", async () => {
      crypto.getRandomValues(secret32);
      const shares = await split(secret32, 5, 3);
      const xCoords = shares.map((s) => s[0]);
      expect(xCoords).toEqual([1, 2, 3, 4, 5]);
    });

    it("produces different shares (no two identical)", async () => {
      crypto.getRandomValues(secret32);
      const shares = await split(secret32, 5, 3);
      for (let i = 0; i < shares.length; i++) {
        for (let j = i + 1; j < shares.length; j++) {
          expect(shares[i]).not.toEqual(shares[j]);
        }
      }
    });

    it("rejects invalid parameters", async () => {
      await expect(split(secret32, 1, 1)).rejects.toThrow();
      await expect(split(secret32, 5, 6)).rejects.toThrow();
      await expect(split(secret32, 5, 1)).rejects.toThrow();
      await expect(split(new Uint8Array(0), 5, 3)).rejects.toThrow();
    });
  });

  describe("reconstruct", () => {
    it("reconstructs from exactly threshold shares", async () => {
      const secret = new Uint8Array(32);
      crypto.getRandomValues(secret);

      const shares = await split(secret, 5, 3);
      const result = await reconstruct(shares.slice(0, 3));

      expect(result).toEqual(secret);
    });

    it("reconstructs from more than threshold shares", async () => {
      const secret = new Uint8Array(32);
      crypto.getRandomValues(secret);

      const shares = await split(secret, 5, 3);
      const result = await reconstruct(shares.slice(0, 4));

      expect(result).toEqual(secret);
    });

    it("reconstructs from all shares", async () => {
      const secret = new Uint8Array(32);
      crypto.getRandomValues(secret);

      const shares = await split(secret, 5, 3);
      const result = await reconstruct(shares);

      expect(result).toEqual(secret);
    });

    it("works for all 10 possible 3-of-5 combinations", async () => {
      const secret = new Uint8Array(32);
      crypto.getRandomValues(secret);

      const shares = await split(secret, 5, 3);
      const combos = getCombinations([0, 1, 2, 3, 4], 3);

      expect(combos).toHaveLength(10); // C(5,3) = 10

      for (const combo of combos) {
        const subset = combo.map((i) => shares[i]);
        const result = await reconstruct(subset);
        expect(result).toEqual(secret);
      }
    });

    it("fails with fewer than threshold shares (wrong result)", async () => {
      const secret = new Uint8Array(32);
      crypto.getRandomValues(secret);

      const shares = await split(secret, 5, 3);
      // With only 2 shares, reconstruction should give wrong result
      const result = await reconstruct(shares.slice(0, 2));
      expect(result).not.toEqual(secret);
    });

    it("rejects duplicate shares", async () => {
      const secret = new Uint8Array(32);
      crypto.getRandomValues(secret);

      const shares = await split(secret, 5, 3);
      await expect(
        reconstruct([shares[0], shares[0], shares[1]]),
      ).rejects.toThrow("Duplicate");
    });

    it("rejects too few shares", async () => {
      const secret = new Uint8Array(32);
      crypto.getRandomValues(secret);

      const shares = await split(secret, 5, 3);
      await expect(reconstruct([shares[0]])).rejects.toThrow("at least 2");
    });

    it("rejects shares of different lengths", async () => {
      const share1 = new Uint8Array([1, 10, 20, 30]);
      const share2 = new Uint8Array([2, 10, 20]);
      await expect(reconstruct([share1, share2])).rejects.toThrow(
        "same length",
      );
    });
  });

  describe("different secret sizes", () => {
    it("works with 16-byte secrets", async () => {
      const secret = new Uint8Array(16);
      crypto.getRandomValues(secret);

      const shares = await split(secret, 5, 3);
      const result = await reconstruct(shares.slice(0, 3));

      expect(result).toEqual(secret);
    });

    it("works with 64-byte secrets", async () => {
      const secret = new Uint8Array(64);
      crypto.getRandomValues(secret);

      const shares = await split(secret, 5, 3);
      const result = await reconstruct(shares.slice(0, 3));

      expect(result).toEqual(secret);
    });

    it("works with 1-byte secrets", async () => {
      const secret = new Uint8Array([42]);
      const shares = await split(secret, 5, 3);
      const result = await reconstruct(shares.slice(0, 3));
      expect(result).toEqual(secret);
    });
  });

  describe("different threshold configurations", () => {
    it("works with 2-of-3", async () => {
      const secret = new Uint8Array(32);
      crypto.getRandomValues(secret);

      const shares = await split(secret, 3, 2);
      expect(shares).toHaveLength(3);

      const result = await reconstruct(shares.slice(0, 2));
      expect(result).toEqual(secret);
    });

    it("works with 4-of-7", async () => {
      const secret = new Uint8Array(32);
      crypto.getRandomValues(secret);

      const shares = await split(secret, 7, 4);
      expect(shares).toHaveLength(7);

      const result = await reconstruct(shares.slice(0, 4));
      expect(result).toEqual(secret);
    });
  });

  // Finding #3: the server holds NO Shamir shard. The master key is split into
  // exactly 4 shares — 1 device + 3 trusted contacts — and recovery must work
  // from device + contact shards alone (no server-held custodian shard exists).
  describe("server-less 4-share scheme (finding #3)", () => {
    // Slot mapping mirrors the app:
    //   shards[0] → device (localStorage, cleared on logout)
    //   shards[1..3] → trusted contacts at shardIndex 2..4
    const DEVICE = 0;
    const CONTACTS = [1, 2, 3];

    it("splits the master key into exactly 4 shares (no server shard)", async () => {
      const masterKey = new Uint8Array(32);
      crypto.getRandomValues(masterKey);
      const shards = await split(masterKey, 4, 2);
      expect(shards).toHaveLength(4);
      // x-coordinates 1..4, none reserved for a 5th server-held share.
      expect(shards.map((s) => s[0])).toEqual([1, 2, 3, 4]);
    });

    it("threshold-2: reconstructs from device + ONE contact", async () => {
      const masterKey = new Uint8Array(32);
      crypto.getRandomValues(masterKey);
      const shards = await split(masterKey, 4, 2);

      const result = await reconstruct([shards[DEVICE], shards[CONTACTS[0]]]);
      expect(result).toEqual(masterKey);
    });

    it("threshold-2: reconstructs from TWO contacts alone (owner gone, no device)", async () => {
      const masterKey = new Uint8Array(32);
      crypto.getRandomValues(masterKey);
      const shards = await split(masterKey, 4, 2);

      // Post-mortem contacts-only path: device shard is cleared on logout.
      const result = await reconstruct([
        shards[CONTACTS[0]],
        shards[CONTACTS[1]],
      ]);
      expect(result).toEqual(masterKey);
    });

    it("threshold-3: reconstructs from all THREE contacts (no device, no server)", async () => {
      const masterKey = new Uint8Array(32);
      crypto.getRandomValues(masterKey);
      const shards = await split(masterKey, 4, 3);

      const result = await reconstruct(CONTACTS.map((i) => shards[i]));
      expect(result).toEqual(masterKey);
    });

    it("every threshold-meeting combination reconstructs, for both thresholds", async () => {
      for (const threshold of [2, 3]) {
        const masterKey = new Uint8Array(32);
        crypto.getRandomValues(masterKey);
        const shards = await split(masterKey, 4, threshold);
        const combos = getCombinations([0, 1, 2, 3], threshold);
        for (const combo of combos) {
          const result = await reconstruct(combo.map((i) => shards[i]));
          expect(result).toEqual(masterKey);
        }
      }
    });

    it("fewer-than-threshold shares cannot reconstruct the master key", async () => {
      const masterKey = new Uint8Array(32);
      crypto.getRandomValues(masterKey);

      // threshold-3: any 2 shares (including a lone-device or two-contact pair)
      // must NOT recover the key.
      const shards = await split(masterKey, 4, 3);
      for (const combo of getCombinations([0, 1, 2, 3], 2)) {
        const result = await reconstruct(combo.map((i) => shards[i]));
        expect(result).not.toEqual(masterKey);
      }
    });

    it("a single shard reveals nothing (server-absent scenario)", async () => {
      // The server holds no shard at all; even if it could observe ONE contact
      // shard, a lone share cannot reach the 2-share floor to reconstruct.
      const masterKey = new Uint8Array(32);
      crypto.getRandomValues(masterKey);
      const shards = await split(masterKey, 4, 2);

      await expect(reconstruct([shards[CONTACTS[0]]])).rejects.toThrow(
        "at least 2",
      );
    });
  });

  describe("zero-knowledge property", () => {
    it("2 shares reveal nothing about a 3-of-5 split", async () => {
      // Statistical test: split same secret many times,
      // verify that 2-share reconstructions vary widely
      const secret = new Uint8Array(1).fill(100);
      const results = new Set<number>();

      for (let trial = 0; trial < 20; trial++) {
        const shares = await split(secret, 5, 3);
        const wrongResult = await reconstruct([shares[0], shares[1]]);
        results.add(wrongResult[0]);
      }

      // With truly random polynomials, 2 shares should produce varied wrong results
      expect(results.size).toBeGreaterThan(1);
    });
  });
});

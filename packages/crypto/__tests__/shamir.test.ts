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

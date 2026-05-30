import { describe, it, expect } from "vitest";
import {
  uint8ToBase64,
  base64ToUint8,
  uint8ToHex,
  constantTimeStringEquals,
} from "../src/encoding";

describe("encoding helpers", () => {
  it("round-trips bytes through base64", () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255, 128]);
    expect(base64ToUint8(uint8ToBase64(bytes))).toEqual(bytes);
  });

  it("uint8ToHex produces lowercase, zero-padded hex", () => {
    expect(uint8ToHex(new Uint8Array([0, 15, 16, 255]))).toBe("000f10ff");
  });

  describe("constantTimeStringEquals", () => {
    it("returns true for equal strings", () => {
      expect(constantTimeStringEquals("abc123", "abc123")).toBe(true);
    });

    it("returns false for different strings of equal length", () => {
      expect(constantTimeStringEquals("abc123", "abc124")).toBe(false);
    });

    it("returns false for different lengths", () => {
      expect(constantTimeStringEquals("abc", "abcd")).toBe(false);
      expect(constantTimeStringEquals("abcd", "abc")).toBe(false);
    });

    it("returns true for two empty strings", () => {
      expect(constantTimeStringEquals("", "")).toBe(true);
    });
  });
});

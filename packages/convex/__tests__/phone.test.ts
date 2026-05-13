import { describe, it, expect } from "vitest";
import { normalizeE164 } from "../lib/phone";

describe("normalizeE164", () => {
  it("returns undefined for empty / whitespace input", () => {
    expect(normalizeE164(undefined)).toBeUndefined();
    expect(normalizeE164("")).toBeUndefined();
    expect(normalizeE164("   ")).toBeUndefined();
  });

  it("accepts a valid E.164 number", () => {
    expect(normalizeE164("+33612345678")).toBe("+33612345678");
  });

  it("trims surrounding whitespace before validating", () => {
    expect(normalizeE164("  +14155552671  ")).toBe("+14155552671");
  });

  it("rejects numbers without a leading +", () => {
    expect(() => normalizeE164("14155552671")).toThrow(/Invalid phone number/);
  });

  it("rejects numbers that are too short", () => {
    expect(() => normalizeE164("+1234")).toThrow(/Invalid phone number/);
  });

  it("rejects numbers with embedded punctuation", () => {
    expect(() => normalizeE164("+1 (415) 555-2671")).toThrow(
      /Invalid phone number/,
    );
  });
});

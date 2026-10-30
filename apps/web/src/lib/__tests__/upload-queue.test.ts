import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { isQuotaError } from "../upload-queue";

// Text saves (edits, restores, imports) and uploads share one storage-full
// prompt: the server refuses both with STORAGE_QUOTA_EXCEEDED.
describe("isQuotaError", () => {
  it("recognises the server's storage-full refusal", () => {
    expect(
      isQuotaError(new ConvexError({ code: "STORAGE_QUOTA_EXCEEDED" })),
    ).toBe(true);
    expect(
      isQuotaError(new Error("Uncaught ConvexError: STORAGE_QUOTA_EXCEEDED")),
    ).toBe(true);
  });

  it("leaves any other failure to the generic message", () => {
    expect(isQuotaError(new ConvexError("Item is archived"))).toBe(false);
    expect(isQuotaError(new Error("Network error"))).toBe(false);
    expect(isQuotaError("STORAGE_QUOTA_EXCEEDED")).toBe(false);
  });
});

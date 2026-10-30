import { describe, expect, it } from "vitest";
import { inertBlobType } from "../use-decrypted-attachment-url";

describe("inertBlobType", () => {
  it.each([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "audio/mpeg",
    "video/mp4",
  ])("keeps the media type %s", (mimeType) => {
    expect(inertBlobType(mimeType)).toBe(mimeType);
  });

  it.each([
    "text/html",
    "TEXT/HTML",
    "text/html; charset=utf-8",
    "application/xhtml+xml",
    "image/svg+xml",
    "text/xml",
    "application/xml",
    "text/javascript",
    "",
    undefined,
  ])("never lets %j render as a document on the app origin", (mimeType) => {
    expect(inertBlobType(mimeType)).toBe("application/octet-stream");
  });
});

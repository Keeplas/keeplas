import { describe, expect, it } from "vitest";
import { ACCEPT, acceptsFile, captureKindOf } from "../attachment-capture";

const file = (name: string, type: string) => ({ name, type });

describe("attachment capture", () => {
  it("accepts PDF, Word and images as documents", () => {
    expect(acceptsFile(file("a.pdf", "application/pdf"), ACCEPT.document)).toBe(
      true,
    );
    expect(acceptsFile(file("a.DOCX", ""), ACCEPT.document)).toBe(true);
    expect(acceptsFile(file("a.heic", "image/heic"), ACCEPT.document)).toBe(
      true,
    );
    expect(acceptsFile(file("a.mp4", "video/mp4"), ACCEPT.document)).toBe(
      false,
    );
    expect(acceptsFile(file("a.zip", "application/zip"), ACCEPT.any)).toBe(
      false,
    );
  });

  it("keeps photos and videos to their own type", () => {
    expect(acceptsFile(file("a.jpg", "image/jpeg"), ACCEPT.photo)).toBe(true);
    expect(acceptsFile(file("a.pdf", "application/pdf"), ACCEPT.photo)).toBe(
      false,
    );
    expect(acceptsFile(file("a.mov", "video/quicktime"), ACCEPT.video)).toBe(
      true,
    );
  });

  it("opens the dialog that matches dropped files", () => {
    expect(captureKindOf([file("a.jpg", "image/jpeg")])).toBe("photo");
    expect(captureKindOf([file("a.mp4", "video/mp4")])).toBe("video");
    expect(
      captureKindOf([
        file("a.jpg", "image/jpeg"),
        file("b.pdf", "application/pdf"),
      ]),
    ).toBe("document");
  });
});

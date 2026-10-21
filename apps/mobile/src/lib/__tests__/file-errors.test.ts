import {
  classifyFileError,
  errorReference,
  FileProblemError,
} from "../file-errors";

describe("file errors", () => {
  it("reports offline first when the phone has no connection", () => {
    expect(classifyFileError(new Error("anything"), false)).toBe("offline");
  });

  it("keeps the problem an explicit FileProblemError carries", () => {
    expect(classifyFileError(new FileProblemError("missing"), true)).toBe(
      "missing",
    );
  });

  it("recognises a failed decryption", () => {
    const op = new Error(
      "The operation failed for an operation-specific reason",
    );
    op.name = "OperationError";
    expect(classifyFileError(op, true)).toBe("decrypt");
    expect(
      classifyFileError(new Error("Corrupted stream: frame smaller"), true),
    ).toBe("decrypt");
  });

  it("recognises a full phone", () => {
    expect(classifyFileError(new Error("ENOSPC: no space left"), true)).toBe(
      "space",
    );
  });

  it("recognises network failures and missing blobs", () => {
    expect(
      classifyFileError(new Error("The request timed out."), undefined),
    ).toBe("offline");
    expect(
      classifyFileError(new Error("Unable to download file: 404"), true),
    ).toBe("missing");
  });

  it("falls back to unknown", () => {
    expect(classifyFileError(new Error("boom"), true)).toBe("unknown");
    expect(classifyFileError("boom", true)).toBe("unknown");
  });

  it("builds a short support reference", () => {
    expect(errorReference(0)).toMatch(/^ERR-[0-9A-Z]{1,5}$/);
  });
});

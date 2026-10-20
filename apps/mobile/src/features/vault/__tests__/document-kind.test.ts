import { documentKind } from "../document-kind";

describe("document kind", () => {
  it("opens PDFs by type or extension", () => {
    expect(documentKind("policy.pdf", "application/octet-stream")).toBe("pdf");
    expect(documentKind("scan", "application/pdf")).toBe("pdf");
  });

  it("opens plain text files as text", () => {
    expect(documentKind("notes.txt", "text/plain")).toBe("text");
    expect(documentKind("export.csv", "application/octet-stream")).toBe("text");
    expect(documentKind("README.MD", "")).toBe("text");
  });

  it("leaves other formats to the fallback", () => {
    expect(documentKind("will.docx", "application/vnd.openxmlformats")).toBe(
      "other",
    );
    expect(documentKind("archive", "application/zip")).toBe("other");
  });
});

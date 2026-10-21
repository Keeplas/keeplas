import { convertibleOffice, documentKind } from "../document-kind";

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

  it("opens Word, Excel and other office files in the office viewer", () => {
    expect(documentKind("will.docx", "application/vnd.openxmlformats")).toBe(
      "office",
    );
    expect(documentKind("budget.XLSX", "")).toBe("office");
    expect(documentKind("deck.pptx", "")).toBe("office");
    expect(convertibleOffice("will.docx")).toBe("word");
    expect(convertibleOffice("budget.xls")).toBe("sheet");
    expect(convertibleOffice("deck.pptx")).toBeNull();
  });

  it("leaves other formats to the fallback", () => {
    expect(documentKind("archive", "application/zip")).toBe("other");
  });
});

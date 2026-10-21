export type DocumentKind = "pdf" | "text" | "office" | "other";

const TEXT_EXTENSIONS = ["txt", "md", "csv", "json", "log", "xml"];
const OFFICE_EXTENSIONS = [
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "rtf",
  "pages",
  "numbers",
  "key",
];
const WORD_EXTENSIONS = ["docx"];
const SHEET_EXTENSIONS = ["xlsx", "xls", "xlsm", "ods"];

const extensionOf = (name: string) =>
  name.split(".").pop()?.toLowerCase() ?? "";

export function convertibleOffice(name: string): "word" | "sheet" | null {
  const extension = extensionOf(name);
  if (WORD_EXTENSIONS.includes(extension)) return "word";
  if (SHEET_EXTENSIONS.includes(extension)) return "sheet";
  return null;
}

export function documentKind(name: string, mimeType: string): DocumentKind {
  const extension = extensionOf(name);
  if (mimeType === "application/pdf" || extension === "pdf") return "pdf";
  if (mimeType.startsWith("text/") || TEXT_EXTENSIONS.includes(extension))
    return "text";
  if (OFFICE_EXTENSIONS.includes(extension) || convertibleOffice(name)) {
    return "office";
  }
  return "other";
}

export type DocumentKind = "pdf" | "text" | "other";

const TEXT_EXTENSIONS = ["txt", "md", "csv", "json", "log", "xml"];

export function documentKind(name: string, mimeType: string): DocumentKind {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType === "application/pdf" || extension === "pdf") return "pdf";
  if (mimeType.startsWith("text/") || TEXT_EXTENSIONS.includes(extension))
    return "text";
  return "other";
}

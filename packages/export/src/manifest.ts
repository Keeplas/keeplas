export interface ImportFile {
  name: string;
  mimeType: string;
  path: string;
}

export interface ImportItem {
  title: string;
  category: string;
  folder: string | null;
  note: string;
  links: string[];
  files: ImportFile[];
}

export class InvalidManifestError extends Error {}

const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.slice(0, max) : "";

export function parseManifest(json: string): ImportItem[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new InvalidManifestError("items.json is not valid JSON");
  }
  const root = data as { format?: unknown; version?: unknown; items?: unknown };
  if (root.format !== "keeplas-export" || root.version !== 1) {
    throw new InvalidManifestError("Not a Keeplas export (format or version)");
  }
  if (!Array.isArray(root.items)) {
    throw new InvalidManifestError("items.json has no items list");
  }
  return root.items.map((raw): ImportItem => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const note = (item.note ?? {}) as Record<string, unknown>;
    const files = Array.isArray(item.files) ? item.files : [];
    const links = Array.isArray(item.links) ? item.links : [];
    return {
      title: text(item.title, 500),
      category: text(item.category, 40),
      folder:
        typeof item.folder === "string" ? item.folder.slice(0, 200) : null,
      note: text(note.html, 2_000_000) || text(note.text, 2_000_000),
      links: links.filter((link): link is string => typeof link === "string"),
      files: files
        .map((rawFile) => {
          const file = (rawFile ?? {}) as Record<string, unknown>;
          return {
            name: text(file.name, 255),
            mimeType: text(file.mimeType, 255) || "application/octet-stream",
            path: text(file.path, 1_000),
          };
        })
        .filter((file) => file.path.startsWith("files/")),
    };
  });
}

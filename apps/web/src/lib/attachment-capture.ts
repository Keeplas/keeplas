import type { FileKind } from "@keeplas/backend/lib/vault_groups";

// Which files the vault takes, and how they are typed. Pure module.

/** "up to 100 MB each" (W06-3); the plan quota still applies server-side. */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

/** What an "Add" entry picks: documents (PDF, Word, images), photos, videos. */
export type CaptureKind = "document" | "photo" | "video";

const WORD =
  ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const ACCEPT: Record<CaptureKind | "any", string> = {
  document: `.pdf,application/pdf,${WORD},image/*`,
  photo: "image/*",
  video: "video/*",
  // Upload files and drag and drop (W06-1).
  any: `.pdf,application/pdf,${WORD},image/*,video/*,audio/*`,
};

/** Whether `file` matches an `accept` list (extensions, MIME, `type/*`). */
export function acceptsFile(
  file: { name: string; type: string },
  accept: string,
): boolean {
  const name = file.name.toLowerCase();
  return accept.split(",").some((token) => {
    if (token.startsWith(".")) return name.endsWith(token);
    if (token.endsWith("/*")) return file.type.startsWith(token.slice(0, -1));
    return file.type === token;
  });
}

/** The dialog a set of files opens: photos or videos alone, else documents. */
export function captureKindOf(files: { type: string }[]): CaptureKind {
  if (files.length > 0 && files.every((f) => f.type.startsWith("image/"))) {
    return "photo";
  }
  if (files.length > 0 && files.every((f) => f.type.startsWith("video/"))) {
    return "video";
  }
  return "document";
}

export type { FileKind };

export function inferFileKind(mimeType: string): FileKind {
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  return "document";
}
